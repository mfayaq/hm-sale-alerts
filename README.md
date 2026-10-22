# hm-sale-alerts

Telegram alerts for H&M India sale items that meet a minimum discount.

An unofficial personal tool. It is not affiliated with H&M. It reads the public listing data the H&M website itself uses, so it may stop working or be restricted at any time. Check H&M's terms before using it.

## How it works

- A GitHub Actions workflow (`.github/workflows/hm-sale-runner.yml`) runs on manual dispatch.
- `runner/src` fetches the sale listing, applies the thresholds in `runner/config.json`, skips items already alerted, and sends batched Telegram messages with in-stock sizes.
- Alert state is kept in `seen.json` on a separate `state` branch so unchanged items are not re-sent.
- Optional back-in-stock alerts are controlled by `restockAlerts` in `runner/config.json`.

## Setup

Add these repository secrets (Settings > Secrets and variables > Actions):

- `TELEGRAM_BOT_TOKEN` - token of your own Telegram bot
- `TELEGRAM_CHAT_ID` - the chat that receives alerts

Run the workflow once with `dry_run` enabled to check counts without sending messages or writing state.

## Tests

```
cd runner && npm test
```
