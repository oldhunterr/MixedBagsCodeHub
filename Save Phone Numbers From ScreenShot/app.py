import os
import pytesseract
from PIL import Image
import re
from concurrent.futures import ThreadPoolExecutor
import time

# Path to the Tesseract executable (update this with your Tesseract installation path)
pytesseract.pytesseract.tesseract_cmd = r'C:\\Program Files\\Tesseract-OCR\\tesseract.exe'

# Function to extract phone numbers from OCR text
def extract_phone_numbers(ocr_text):
    # Regular expression to match phone numbers
    phone_regex = r'(\+?973\s?\d{4}\s?\d{4})'
    phone_numbers = re.findall(phone_regex, ocr_text)
    
    return phone_numbers

# Function to perform OCR on an image
def ocr_image(image_path):
    # Open the image file
    with Image.open(image_path) as img:
        # Perform OCR on the image
        ocr_text = pytesseract.image_to_string(img)
        return ocr_text

# Function to process a single image
def process_image(image_path):
    ocr_text = ocr_image(image_path)
    phone_numbers = extract_phone_numbers(ocr_text)
    return phone_numbers

# Main function to process multiple images
def process_images(image_paths):
    all_phone_numbers = set()  # Use a set to avoid duplicates
    invalid_phone_numbers = []  # List to store invalid phone numbers
    
    # Process images concurrently
    with ThreadPoolExecutor(max_workers=os.cpu_count()) as executor:
        futures = [executor.submit(process_image, image_path) for image_path in image_paths]
        
        for future in futures:
            phone_numbers = future.result()
            for phone_number in phone_numbers:
                if phone_number.startswith('+') and not re.match(r'\+?973\s?\d{4}\s?\d{4}', phone_number):
                    invalid_phone_numbers.append(phone_number)
                else:
                    all_phone_numbers.add(phone_number)
    
    return all_phone_numbers, invalid_phone_numbers


# Get the current directory
current_directory = os.path.dirname(os.path.abspath(__file__))

# List all files in the directory
all_files = os.listdir(current_directory)

# Filter only the image files with a .png extension
image_paths = [os.path.join(current_directory, filename) for filename in all_files if filename.lower().endswith('.png')]

# Record the start time
start_time = time.time()

# Process the images and extract phone numbers
valid_phone_numbers, invalid_phone_numbers = process_images(image_paths)

# Calculate the elapsed time
elapsed_time = time.time() - start_time
print("Elapsed time:", elapsed_time, "seconds")

# Save the valid phone numbers to a file
with open('valid_phone_numbers.txt', 'w') as f:
    for phone_number in valid_phone_numbers:
        f.write(phone_number + '\n')

# Save the invalid phone numbers to a file
with open('invalid_phone_numbers.txt', 'w') as f:
    for phone_number in invalid_phone_numbers:
        f.write(phone_number + '\n')
