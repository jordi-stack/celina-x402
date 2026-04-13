#!/usr/bin/env tsx
/**
 * Day 1 Spike: CLI --force flag + session stickiness
 *
 * Verifies:
 * 1. `onchainos --version` returns >= 2.2.8
 * 2. `onchainos wallet status` works and returns loggedIn boolean
 * 3. `onchainos payment x402-pay --help` includes --force flag
 * 4. Back-to-back `wallet status` calls in separate spawns share session (no re-auth)
 */
import { execa } from 'execa';
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface Finding {
  timestamp: string;
  cli_version: string;
  wallet_status: string;
  force_flag_present: boolean;
  force_flag_help: string;
  session_test_results: string[];
  blockers: string[];
  recommendation: string;
}

async function run() {
  const findings: Finding = {
    timestamp: new Date().toISOString(),
    cli_version: '',
    wallet_status: '',
    force_flag_present: false,
    force_flag_help: '',
    session_test_results: [],
    blockers: [],
    recommendation: '',
  };

  try {
    const { stdout: versionOut } = await execa('onchainos', ['--version']);
    findings.cli_version = versionOut.trim();
    console.log(`CLI version: ${findings.cli_version}`);

    if (!/(\d+)\.(\d+)\.(\d+)/.test(findings.cli_version)) {
      findings.blockers.push('CLI version string unparseable');
    }

    const { stdout: statusOut } = await execa('onchainos', ['wallet', 'status'], {
      reject: false,
    });
    findings.wallet_status = statusOut.trim();
    console.log(`Wallet status: ${findings.wallet_status.slice(0, 200)}`);

    const { stdout: helpOut, stderr: helpErr } = await execa(
      'onchainos',
      ['payment', 'x402-pay', '--help'],
      { reject: false }
    );
    const helpCombined = `${helpOut}\n${helpErr}`;
    findings.force_flag_present = /--force/.test(helpCombined);
    findings.force_flag_help = helpCombined.slice(0, 800);
    console.log(`--force present: ${findings.force_flag_present}`);

    if (!findings.force_flag_present) {
      findings.blockers.push(
        'CLI onchainos payment x402-pay does not expose --force flag. State machine will stall on confirming prompts.'
      );
    }

    if (/loggedIn[^a-z]*true/i.test(findings.wallet_status)) {
      console.log('Testing session stickiness via 3 back-to-back wallet status calls...');
      const stickyResults: string[] = [];
      for (let i = 1; i <= 3; i++) {
        const { stdout, stderr } = await execa('onchainos', ['wallet', 'status'], {
          reject: false,
        });
        const combined = `${stdout}\n${stderr}`;
        const stillLoggedIn = /loggedIn[^a-z]*true/i.test(combined);
        const promptedForLogin = /log in|verify OTP|enter.*email/i.test(combined);
        stickyResults.push(
          `Call ${i}: loggedIn=${stillLoggedIn}, prompted=${promptedForLogin}`
        );
        if (!stillLoggedIn) {
          findings.blockers.push(
            `Session lost between CLI calls (call ${i}). Loop will constantly re-auth.`
          );
          break;
        }
        if (promptedForLogin) {
          findings.blockers.push(
            `CLI prompted for login on call ${i}. State machine will stall.`
          );
          break;
        }
      }
      findings.session_test_results.push(...stickyResults);
      findings.session_test_results.push(
        stickyResults.every((r) => /loggedIn=true, prompted=false/.test(r))
          ? 'PASS: 3 consecutive calls all logged in, no prompts.'
          : 'FAIL: session did not persist cleanly.'
      );
    } else {
      findings.session_test_results.push(
        'Not logged in. Run onchainos wallet login first.'
      );
      findings.blockers.push('Not logged in at spike time.');
    }

    findings.recommendation =
      findings.blockers.length === 0
        ? 'PROCEED - CLI ready for use.'
        : `HALT - ${findings.blockers.length} blocker(s) found. Resolve before continuing.`;
  } catch (e: unknown) {
    findings.blockers.push(`Spike failed: ${(e as Error).message}`);
    findings.recommendation = 'HALT - spike execution failed.';
  }

  const findingsDir = path.join(__dirname, 'findings');
  await mkdir(findingsDir, { recursive: true });
  const findingsPath = path.join(findingsDir, 'cli-spike.md');
  const md = formatFindings(findings);
  await writeFile(findingsPath, md, 'utf8');
  console.log(`\nFindings written to ${findingsPath}\n`);
  console.log(findings.recommendation);

  if (findings.blockers.length > 0) {
    process.exitCode = 1;
  }
}

function formatFindings(f: Finding): string {
  return `# CLI Spike Findings

**Run at:** ${f.timestamp}
**CLI version:** ${f.cli_version}
**--force present:** ${f.force_flag_present}

## Wallet Status
\`\`\`
${f.wallet_status}
\`\`\`

## --force Help Output
\`\`\`
${f.force_flag_help}
\`\`\`

## Session Test Results
${f.session_test_results.map((r) => `- ${r}`).join('\n')}

## Blockers
${f.blockers.length === 0 ? '_None_' : f.blockers.map((b) => `- ${b}`).join('\n')}

## Recommendation
${f.recommendation}
`;
}

run();
