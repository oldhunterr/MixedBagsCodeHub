import tkinter as tk
from tkinter import filedialog, messagebox
import os
import shutil

class FileCopier:
    def __init__(self, root):
        self.root = root
        self.root.title("File Copier")

        self.base_folder = tk.StringVar()
        self.destination_folder = tk.StringVar()
        self.copy_mode = tk.StringVar(value="path")  # Default to "Path" mode

        self.setup_widgets()

    def setup_widgets(self):
        # Base Folder selection
        label_base_folder = tk.Label(self.root, text="Base Folder:")
        label_base_folder.grid(row=0, column=0, padx=10, pady=5)
        entry_base_folder = tk.Entry(self.root, textvariable=self.base_folder, width=50)
        entry_base_folder.grid(row=0, column=1, padx=10, pady=5)
        button_browse_base = tk.Button(self.root, text="Browse", command=self.select_base_folder)
        button_browse_base.grid(row=0, column=2, padx=10, pady=5)

        # Destination Folder selection
        label_dest_folder = tk.Label(self.root, text="Destination Folder:")
        label_dest_folder.grid(row=1, column=0, padx=10, pady=5)
        entry_dest_folder = tk.Entry(self.root, textvariable=self.destination_folder, width=50)
        entry_dest_folder.grid(row=1, column=1, padx=10, pady=5)
        button_browse_dest = tk.Button(self.root, text="Browse", command=self.select_destination_folder)
        button_browse_dest.grid(row=1, column=2, padx=10, pady=5)

        # Mode selection
        label_mode = tk.Label(self.root, text="Mode:")
        label_mode.grid(row=2, column=0, padx=10, pady=5)
        radio_path_mode = tk.Radiobutton(self.root, text="Path", variable=self.copy_mode, value="path")
        radio_path_mode.grid(row=2, column=1, sticky="w")
        radio_filename_mode = tk.Radiobutton(self.root, text="File Name", variable=self.copy_mode, value="filename")
        radio_filename_mode.grid(row=2, column=2, sticky="w")

        # File paths input
        label_file_paths = tk.Label(self.root, text="File Paths:")
        label_file_paths.grid(row=3, column=0, padx=10, pady=5)
        self.text_widget = tk.Text(self.root, height=10, width=60)  # Class attribute for accessibility
        self.text_widget.grid(row=3, column=1, columnspan=2, padx=10, pady=5)

        # Copy button
        button_copy = tk.Button(self.root, text="Copy Files", command=self.copy_files)
        button_copy.grid(row=4, column=1, padx=10, pady=20)

    def select_base_folder(self):
        folder = filedialog.askdirectory()
        if folder:
            self.base_folder.set(folder)

    def select_destination_folder(self):
        folder = filedialog.askdirectory()
        if folder:
            self.destination_folder.set(folder)

    def is_valid_path(self, base, path):
        full_path = os.path.join(base, path.strip())
        return os.path.exists(full_path)

    def normalize_path(self, base, path):
        # Remove leading slash if present
        normalized_path = path.lstrip("/\\")
        return os.path.join(base, normalized_path.strip())

    def copy_files(self):
        base = self.base_folder.get()
        dest = self.destination_folder.get()
        file_paths = self.text_widget.get("1.0", tk.END).splitlines()  # Access text_widget as a class attribute

        if not base or not dest:
            messagebox.showwarning("Warning", "Please select both folders.")
            return

        for file_path in file_paths:
            file_path = file_path.strip()  # Remove leading and trailing whitespace
            if file_path:  # Ignore empty lines
                if self.copy_mode.get() == "path":
                    # Handle as full or relative path
                    normalized_path = self.normalize_path(base, file_path)
                    if self.is_valid_path(base, normalized_path):
                        shutil.copy2(normalized_path, dest)
                    else:
                        print(f"Skipped invalid path: {file_path}")
                elif self.copy_mode.get() == "filename":
                    # Treat as just a filename and search recursively
                    found = False
                    for root, dirs, files in os.walk(base):
                        if file_path in files:
                            full_file_path = os.path.join(root, file_path)
                            shutil.copy2(full_file_path, dest)
                            found = True
                            break
                    if not found:
                        print(f"File not found: {file_path}")

        messagebox.showinfo("Success", "Files copied successfully!")

# Create the main application window
root = tk.Tk()
file_copier = FileCopier(root)
root.mainloop()