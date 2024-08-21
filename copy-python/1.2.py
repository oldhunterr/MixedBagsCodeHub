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
    mode = copy_mode.get()
    
    if not base or not dest:
        messagebox.showwarning("Warning", "Please select both folders.")
        return

    for file_path in file_paths:
        if file_path.strip():  # Ignore empty lines
            if mode == "path":
                # Handle as full or relative path
                normalized_path = normalize_path(base, file_path)
                if is_valid_path(base, normalized_path):
                    shutil.copy2(normalized_path, dest)
                else:
                    print(f"Skipped invalid path: {file_path.strip()}")
            elif mode == "filename":
                # Treat as just a filename and search recursively
                found = False
                for root, dirs, files in os.walk(base):
                    if file_path.strip() in files:
                        full_file_path = os.path.join(root, file_path.strip())
                        shutil.copy2(full_file_path, dest)
                        found = True
                        break
                
                if not found:
                    print(f"File not found: {file_path.strip()}")

    messagebox.showinfo("Success", "Files copied successfully!")



# Set up the main application window
root = tk.Tk()
root.title("File Copier")

# Set up variables to hold folder paths
base_folder = tk.StringVar()
destination_folder = tk.StringVar()

# Set up other variables
copy_mode = tk.StringVar(value="path")  # Default to "Path" mode

# Base Folder selection
tk.Label(root, text="Base Folder:").grid(row=0, column=0, padx=10, pady=5)
tk.Entry(root, textvariable=base_folder, width=50).grid(row=0, column=1, padx=10, pady=5)
tk.Button(root, text="Browse", command=select_base_folder).grid(row=0, column=2, padx=10, pady=5)

# Destination Folder selection
tk.Label(root, text="Destination Folder:").grid(row=1, column=0, padx=10, pady=5)
tk.Entry(root, textvariable=destination_folder, width=50).grid(row=1, column=1, padx=10, pady=5)
tk.Button(root, text="Browse", command=select_destination_folder).grid(row=1, column=2, padx=10, pady=5)

tk.Label(root, text="Mode:").grid(row=2, column=0, padx=10, pady=5)
tk.Radiobutton(root, text="Path", variable=copy_mode, value="path").grid(row=2, column=1, sticky="w")
tk.Radiobutton(root, text="File Name", variable=copy_mode, value="filename").grid(row=2, column=2, sticky="w")


# File paths input
tk.Label(root, text="File Paths:").grid(row=3, column=0, padx=10, pady=5)
text_widget = tk.Text(root, height=10, width=60)
text_widget.grid(row=3, column=1, columnspan=2, padx=10, pady=5)

# Copy button
tk.Button(root, text="Copy Files", command=copy_files).grid(row=4, column=1, padx=10, pady=20)

root.mainloop()
