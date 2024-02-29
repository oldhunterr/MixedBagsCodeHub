# Parse SMS Transaction Messages (Tampermonkey Script)

## Description

This Tampermonkey script adds a button to parse and save transaction messages, specifically designed for the BISB SMS format. It enhances user experience by providing a convenient way to extract and store transaction details from SMS messages.

## Installation

1. Ensure you have the Tampermonkey extension installed in your web browser.
2. Copy the script content.
3. Open the Tampermonkey dashboard.
4. Create a new script and paste the copied content.
5. Save the script.

## Usage

1. Navigate to the Google Messages web interface (`https://messages.google.com/*`).
2. After a few seconds, a circular button with an arrow icon will appear at the top right corner of the page. This is the "Parse and Save" button.
3. Clicking on this button will trigger the parsing of transaction messages from the conversation thread.
4. Once parsed, the transactions will be saved in JSON format and downloaded automatically.
5. The parsed data includes details such as transaction amount, date, account/card number, transaction type, and balance information.
6. If there are any OTP messages detected, they will be listed separately.

## Notes

- The script may take a few seconds to initialize and display the button.
- Ensure that the web page is fully loaded before attempting to use the button.
- If you encounter any issues with the script, you can check the console for error messages.
- This script is provided as-is and may not be actively maintained. Use it at your own discretion.

## License

This script is provided under the [MIT License](LICENSE).
