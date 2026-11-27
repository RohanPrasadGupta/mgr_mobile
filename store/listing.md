# Store listing (copy into App Store Connect / Google Play Console)

Replace `<host>` with the address from the AWS deploy (or your domain later).

## Identity
| Field | Value |
|---|---|
| App name | MoneyMgr (backup if taken: "MoneyMgr: Budget & Expenses") |
| Bundle ID / package | `com.rohangupta.moneymgr` |
| Category | Finance |
| Price | Free |
| Age rating | 4+ (Apple) / Everyone (Google): no user content shared, no ads, no gambling |
| Support / contact email | rohg505@gmail.com |
| Privacy policy URL | `https://app.<host>/privacy` |
| Account deletion URL (Google) | `https://app.<host>/delete-account` |
| Marketing / website URL | `https://app.<host>` |

## Subtitle (Apple, max 30 characters)
Track spending, budgets & goals

## Short description (Google, max 80 characters)
Track spending, budgets, savings goals and investments — across all your devices.

## Promotional text (Apple, max 170 characters)
See where your money goes. Record spending in seconds, set monthly budgets, save towards goals and follow your investments — in any currency.

## Full description (both stores)
MoneyMgr is a simple, private way to understand your money.

TRACK EVERYTHING IN ONE PLACE
• Cash, bank accounts, wallets and cards, each with its live balance
• Add income and expenses in seconds, with categories, tags and notes
• Attach receipt photos or PDFs to any transaction
• Transfers between accounts, including between currencies

PLAN AHEAD
• Monthly budgets per category, with a warning before you overspend
• Savings goals that track progress and tell you how much to put aside each month
• Recurring bills and income that post themselves
• Money you've lent or borrowed, with repayments

SEE THE BIG PICTURE
• Dashboard with this month's income, spending and trends
• Monthly and yearly reports by category and account
• Investments: stocks, funds, gold, crypto and deposits, with gains and a value-over-time chart

MANY CURRENCIES
• Choose your home currency; every total converts automatically using daily exchange rates

YOURS, AND PRIVATE
• No ads, no selling your data, no bank connection required
• Works on iPhone, Android and the web, always in sync
• Export your transactions to CSV any time, or delete your account and all its data from Settings

## Keywords (Apple, max 100 characters, comma-separated)
budget,expense,tracker,spending,money,finance,savings,goals,investment,personal,wallet,bills

## What's new (first release)
First release of MoneyMgr.

## App Review notes (Apple) / App access (Google)
Sign-in is required. Demo account with sample data:
- Email: <the reviewer email you seed>
- Password: <the password you seed>

No paid features, no in-app purchases. The camera / photo library is used only when the user chooses to attach a receipt.
Account deletion: Settings → Delete my account…

## Privacy answers
**Apple — App Privacy ("Data linked to you", used for App Functionality only, not for tracking):**
- Contact info → Email address, Name
- Financial info → Other financial info (records the user enters)
- User content → Photos or videos / Other user content (receipts, notes)
- Identifiers → User ID
- Tracking: **No**

**Google — Data safety:**
- Collected: Personal info (name, email), Financial info (other: user-entered records), Photos and files (receipts), App info (none), Device IDs (none)
- Shared with third parties: **No** (hosting and email providers are service providers, not "sharing")
- Encrypted in transit: **Yes** · Users can request deletion: **Yes** (in app + `/delete-account`)
- Purpose for all: App functionality, Account management

**Google — Financial features declaration:** the app is a personal finance tracker; it does not offer loans, payments, banking, crypto exchange or trading.

## Screenshots to take (on the demo account)
- **iPhone 6.9"** (e.g. iPhone 16/17 Pro Max simulator, 1320×2868): Home dashboard · Transactions list · Add transaction · Budgets · Reports · Investments chart
- **Android phone** (1080×1920 or larger), same six screens
- **Google feature graphic** 1024×500: the wordmark on the dark navy background
- **Icons**: Apple 1024×1024 (from `assets/images/icon.png`), Google 512×512
