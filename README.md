# github-star-history

Track GitHub repository star history from the command line.

## Installation

```bash
npm install -g github-star-history
```

Or run directly with npx:
```bash
npx github-star-history facebook/react
```

## Usage

```bash
github-star-history <owner/repo> [options]
```

### Options

- `--token, -t` - GitHub personal access token for higher API rate limits
- `--chart, -c` - Show ASCII chart
- `--table, -T` - Show table view (default)
- `--json, -j` - Output as JSON
- `--help, -h` - Show help

### Examples

```bash
# Basic usage
github-star-history facebook/react

# Show chart
github-star-history facebook/react --chart

# Show table
github-star-history facebook/react --table

# JSON output
github-star-history facebook/react --json

# With auth token (higher rate limits)
github-star-history facebook/react --token ghp_xxxxx
```

## Features

- ASCII bar chart visualization of star history
- Monthly star addition table
- JSON export for programmatic use
- GitHub token support for higher rate limits

## Rate Limits

Without authentication: 60 requests/hour
With GitHub token: 5,000 requests/hour

Get a token at: https://github.com/settings/tokens

## License

MIT


<!-- minervacap-pre-hiklik-promotion -->
> **Discover Klik:** https://pre.hiklik.ai/
<!-- /minervacap-pre-hiklik-promotion -->
