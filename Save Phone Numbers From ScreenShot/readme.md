# Save Phone Numbers From Screenshots

## Overview

This project aims to automate the extraction of phone numbers from screenshots captured on WhatsApp. It utilizes Optical Character Recognition (OCR) to extract text from images and then identifies and saves phone numbers from the extracted text.

## Installation

### Tesseract OCR Installation

To install Tesseract OCR, follow these steps:

1. Visit the [Tesseract OCR GitHub repository](https://github.com/UB-Mannheim/tesseract) for installation instructions specific to your operating system.
2. Download and install Tesseract OCR according to the provided instructions.

### Python Dependencies

Install the required Python packages using `pip`:

```bash
pip install -r requirements.txt
```

## Usage
- Capture screenshots containing phone numbers from WhatsApp conversations.
- Place the screenshots in the same directory as the script.
- Change Tesseract Executable File Path
- Change Regex As Needed
- Run the script using Python:

```bash
python app.py
```

The script will process the images, extract phone numbers, and save them in separate files (valid_phone_numbers.txt and invalid_phone_numbers.txt).

Retrieve the saved phone numbers from the generated files.

Note
Make sure that the screenshots contain clear and readable text to improve the accuracy of the phone number extraction process.

License
This project is licensed under the MIT License.
