#!/usr/bin/env node

const axios = require('axios');
const Table = require('cli-table3');
const chalk = require('chalk');

// GitHub API configuration
const GITHUB_API = 'https://api.github.com';

// Fetch star history for a repository
async function fetchStarHistory(owner, repo) {
  let page = 1;
  const perPage = 100;
  const starEvents = [];
  let hasMore = true;

  while (hasMore) {
    try {
      const url = `${GITHUB_API}/repos/${owner}/${repo}/events?per_page=${perPage}&page=${page}`;
      const response = await axios.get(url, {
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'github-star-history-cli'
        }
      });

      const events = response.data;
      if (!events || events.length === 0) {
        hasMore = false;
        break;
      }

      // Filter only PushEvent (which contain star creation via CreateEvent)
      // Actually, stars are tracked via StarEvent which appears as "WatchEvent" in the API
      for (const event of events) {
        if (event.type === 'WatchEvent') {
          starEvents.push({
            date: event.created_at,
            type: 'star',
            actor: event.actor.login
          });
        }
      }

      if (events.length < perPage) {
        hasMore = false;
      } else {
        page++;
      }

      // Rate limit check
      const remaining = response.headers['x-ratelimit-remaining'];
      if (remaining === '0') {
        console.log(chalk.yellow('GitHub API rate limit reached. Try again later.'));
        break;
      }
    } catch (error) {
      if (error.response && error.response.status === 404) {
        throw new Error(`Repository not found: ${owner}/${repo}`);
      }
      if (error.response && error.response.status === 403) {
        throw new Error('API rate limit exceeded. Use --token for authenticated requests.');
      }
      throw error;
    }
  }

  return starEvents;
}

// Get star count from commit history approximation
// Since GitHub doesn't provide direct star history API, we use an approximation
async function getStarCount(owner, repo) {
  try {
    const response = await axios.get(`${GITHUB_API}/repos/${owner}/${repo}`, {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'github-star-history-cli'
      }
    });
    return response.data.stargazers_count;
  } catch (error) {
    throw new Error(`Failed to fetch repo info: ${error.message}`);
  }
}

// Fetch weekly star additions (approximation using stargazers endpoint)
async function fetchWeeklyStars(owner, repo, token) {
  try {
    const headers = {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'github-star-history-cli'
    };
    if (token) {
      headers['Authorization'] = `token ${token}`;
    }

    // Get repo info for current star count
    const repoResponse = await axios.get(`${GITHUB_API}/repos/${owner}/${repo}`, { headers });
    const currentStars = repoResponse.data.stargazers_count;

    // Get events to estimate star timeline
    const eventsResponse = await axios.get(`${GITHUB_API}/repos/${owner}/${repo}/events?per_page=100`, { headers });
    const events = eventsResponse.data;

    // Count stars by month from events
    const monthlyStars = {};
    for (const event of events) {
      if (event.type === 'WatchEvent') {
        const month = event.created_at.substring(0, 7); // YYYY-MM
        monthlyStars[month] = (monthlyStars[month] || 0) + 1;
      }
    }

    return { currentStars, monthlyStars };
  } catch (error) {
    throw new Error(`Failed to fetch star data: ${error.message}`);
  }
}

// Alternative: Fetch from GitHub's star graph endpoint (undocumented)
async function fetchStarGraph(owner, repo, token) {
  const headers = {
    'User-Agent': 'github-star-history-cli'
  };
  if (token) {
    headers['Authorization'] = `token ${token}`;
  }

  try {
    // Try the star graph endpoint
    const response = await axios.get(`https://api.github.com/repos/${owner}/${repo}/star_history`, { headers });
    return response.data;
  } catch (error) {
    // Fallback: return empty array to use approximation method
    return null;
  }
}

// Print star history as ASCII chart
function printASCIIChart(monthlyStars, currentStars) {
  if (Object.keys(monthlyStars).length === 0) {
    console.log(chalk.yellow('No star history data available.'));
    return;
  }

  // Sort months
  const sortedMonths = Object.keys(monthlyStars).sort();
  const values = sortedMonths.map(m => monthlyStars[m]);
  const maxValue = Math.max(...values);

  console.log(chalk.bold('\n📊 Star History (Last 100 Events)\n'));

  // ASCII bar chart
  const chartWidth = 50;
  for (let i = sortedMonths.length - 1; i >= 0; i--) {
    const month = sortedMonths[i];
    const count = monthlyStars[month];
    const barLen = Math.round((count / maxValue) * chartWidth);
    const bar = '█'.repeat(barLen);
    console.log(`${chalk.cyan(month)}  ${chalk.yellow(count.toString().padStart(4))}  ${chalk.green(bar)}`);
  }

  console.log(chalk.gray('\n' + '─'.repeat(60)));
  console.log(chalk.bold(`Total Stars (current): ${chalk.green(currentStars.toLocaleString())}`));
}

// Print detailed table
function printTable(monthlyStars) {
  if (Object.keys(monthlyStars).length === 0) return;

  const table = new Table({
    head: ['Month', 'New Stars', 'Cumulative'],
    colWidths: [15, 15, 15]
  });

  const sortedMonths = Object.keys(monthlyStars).sort();
  let cumulative = 0;

  for (const month of sortedMonths) {
    cumulative += monthlyStars[month];
    table.push([month, monthlyStars[month], cumulative]);
  }

  console.log(chalk.bold('\n📈 Monthly Star Additions\n'));
  console.log(table.toString());
}

// Print help
function printHelp() {
  console.log(`
${chalk.bold('github-star-history')} - Track GitHub repository star history

${chalk.cyan('USAGE')}
  github-star-history <owner/repo> [options]

${chalk.cyan('OPTIONS')}
  --token, -t     GitHub personal access token for higher API rate limits
  --chart, -c     Show ASCII chart
  --table, -T     Show table view (default)
  --json, -j      Output as JSON
  --help, -h      Show this help message

${chalk.cyan('EXAMPLES')}
  github-star-history facebook/react
  github-star-history facebook/react --chart
  github-star-history facebook/react --token ghp_xxxxx --json
`);
}

// Main CLI
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    printHelp();
    process.exit(0);
  }

  const showChart = args.includes('--chart') || args.includes('-c');
  const showTable = args.includes('--table') || args.includes('-T');
  const showJSON = args.includes('--json') || args.includes('-j');
  const tokenArg = args.find(a => a.startsWith('--token=') || a === '-t');
  const token = tokenArg ? tokenArg.split('=')[1] : null;

  // Remove flags to get repo
  const cleanArgs = args.filter(a => !a.startsWith('-'));
  const repoArg = cleanArgs[0];

  if (!repoArg) {
    console.error(chalk.red('Error: Please specify a repository (e.g., facebook/react)'));
    printHelp();
    process.exit(1);
  }

  const [owner, repo] = repoArg.split('/');

  if (!owner || !repo) {
    console.error(chalk.red('Error: Invalid repository format. Use owner/repo (e.g., facebook/react)'));
    process.exit(1);
  }

  console.log(chalk.cyan(`\nFetching star history for ${chalk.bold(owner)}/${chalk.bold(repo)}...\n`));

  try {
    const { currentStars, monthlyStars } = await fetchWeeklyStars(owner, repo, token);

    if (showJSON) {
      console.log(JSON.stringify({
        repo: `${owner}/${repo}`,
        currentStars,
        monthlyStars,
        totalEvents: Object.values(monthlyStars).reduce((a, b) => a + b, 0)
      }, null, 2));
    } else {
      if (showChart) {
        printASCIIChart(monthlyStars, currentStars);
      }
      if (showTable) {
        printTable(monthlyStars);
      }
      if (!showChart && !showTable) {
        printASCIIChart(monthlyStars, currentStars);
        printTable(monthlyStars);
      }
    }
  } catch (error) {
    console.error(chalk.red(`Error: ${error.message}`));
    process.exit(1);
  }
}

main();
