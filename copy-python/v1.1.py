import tkinter as tk
from tkinter import filedialog, messagebox
import os
import shutil

def select_base_folder():
    folder = filedialog.askdirectory()
    if folder:
        base_folder.set(folder)

def select_destination_folder():
    folder = filedialog.askdirectory()
    if folder:
        destination_folder.set(folder)

def is_valid_path(base, path):
    full_path = os.path.join(base, path.strip())
    return os.path.exists(full_path)

def normalize_path(base, path):
    # Remove leading slash if present
    normalized_path = path.lstrip("/\\")
    return os.path.join(base, normalized_path.strip())

def copy_files():
    base = base_folder.get()
    dest = destination_folder.get()
    file_paths = text_widget.get("1.0", tk.END).splitlines()
    
    if not base or not dest:
        messagebox.showwarning("Warning", "Please select both folders.")
        return

    for file_path in file_paths:
        if file_path.strip():  # Ignore empty lines
            normalized_path = normalize_path(base, file_path)
            if is_valid_path(base, normalized_path):
                shutil.copy2(normalized_path, dest)
            else:
                print(f"Skipped invalid path: {file_path.strip()}")

    messagebox.showinfo("Success", "Files copied successfully!")

# Set up the main application window
root = tk.Tk()
root.title("File Copier")

# Set up variables to hold folder paths
base_folder = tk.StringVar()
destination_folder = tk.StringVar()

# Base Folder selection
tk.Label(root, text="Base Folder:").grid(row=0, column=0, padx=10, pady=5)
tk.Entry(root, textvariable=base_folder, width=50).grid(row=0, column=1, padx=10, pady=5)
tk.Button(root, text="Browse", command=select_base_folder).grid(row=0, column=2, padx=10, pady=5)

# Destination Folder selection
tk.Label(root, text="Destination Folder:").grid(row=1, column=0, padx=10, pady=5)
tk.Entry(root, textvariable=destination_folder, width=50).grid(row=1, column=1, padx=10, pady=5)
tk.Button(root, text="Browse", command=select_destination_folder).grid(row=1, column=2, padx=10, pady=5)

# File paths input
tk.Label(root, text="File Paths:").grid(row=2, column=0, padx=10, pady=5)
text_widget = tk.Text(root, height=10, width=60)
text_widget.grid(row=2, column=1, columnspan=2, padx=10, pady=5)

# Copy button
tk.Button(root, text="Copy Files", command=copy_files).grid(row=3, column=1, padx=10, pady=20)

root.mainloop()
