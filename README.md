# BMC Auto Next

A Tampermonkey userscript for people who are morally opposed to babysitting a 10-second video and hammering **NEXT** like it’s a part-time job.

Bloomberg Market Concepts / Bloomberg for Education lessons are great, but the pacing is… comedic: play, stop, click **NEXT**, repeat, forever. After the 30th time, you start questioning why “auto-advance” isn’t just a built-in feature.

This script does the one tiny thing the platform really should have done: when a micro-lesson finishes and **NEXT** becomes available, it clicks it for you. No magic, no hacks, no data collection. Just less mind-numbing clicking so you can keep your attention where it belongs (on the content, not the bottom-right corner).

## Features
- Auto-clicks **NEXT** when:
  - NEXT becomes enabled (unlocked), or
  - The slide progress bar reaches ~100%.
- No data collection, no external requests.

## Install
### Option A: GreasyFork (recommended)
1. Install Tampermonkey.
2. Install the script from GreasyFork (not yet able to publish due to some issues).

### Option B: GitHub (source)
Open `src/bmc-autonext.user.js` and install via Tampermonkey.

## Usage
Open a course lesson page, play normally. When the segment completes and NEXT unlocks, the script advances automatically.

## License
MIT.

## Support / Issues
Open an issue: https://github.com/JonasWooh/BMC_AutoNext/issues
