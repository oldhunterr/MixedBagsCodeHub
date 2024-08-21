using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Windows;
using Microsoft.Win32;

namespace FileCopier
{
    public partial class MainWindow : Window
    {
        private string baseFolder;
        private string destinationFolder;
        private string copyMode = "path";

        public MainWindow()
        {
            InitializeComponent();
        }

        private void Button_SelectBaseFolder_Click(object sender, RoutedEventArgs e)
        {
            var dialog = new FolderPicker();
            bool? result = dialog.ShowDialog();

            if (result == true)
            {
                baseFolder = dialog.SelectedFolder;
                TextBox_BaseFolder.Text = baseFolder;
            }
        }

        private void Button_SelectDestinationFolder_Click(object sender, RoutedEventArgs e)
        {
            var dialog = new FolderPicker();
            bool? result = dialog.ShowDialog();

            if (result == true)
            {
                destinationFolder = dialog.SelectedFolder;
                TextBox_DestinationFolder.Text = destinationFolder;
            }
        }

        private void Button_CopyFiles_Click(object sender, RoutedEventArgs e)
        {
            if (string.IsNullOrEmpty(baseFolder) || string.IsNullOrEmpty(destinationFolder))
            {
                MessageBox.Show("Please select both base and destination folders.", "Warning", MessageBoxButton.OK, MessageBoxImage.Warning);
                return;
            }

            var filePaths = TextBox_FilePaths.Text.Split(new[] { Environment.NewLine }, StringSplitOptions.RemoveEmptyEntries);

            foreach (var filePath in filePaths)
            {
                if (string.IsNullOrEmpty(filePath))
                {
                    continue;
                }

                if (copyMode == "path")
                {
                    var fullPath = Path.Combine(baseFolder, filePath.Trim());
                    if (File.Exists(fullPath))
                    {
                        File.Copy(fullPath, Path.Combine(destinationFolder, Path.GetFileName(fullPath)));
                    }
                    else
                    {
                        Console.WriteLine($"Skipped invalid path: {filePath}");
                    }
                }
                else if (copyMode == "filename")
                {
                    bool found = false;
                    foreach (var root in Directory.EnumerateDirectories(baseFolder, "*", SearchOption.AllDirectories))
                    {
                        var file = Path.Combine(root, filePath.Trim());
                        if (File.Exists(file))
                        {
                            File.Copy(file, Path.Combine(destinationFolder, Path.GetFileName(file)));
                            found = true;
                            break;
                        }
                    }

                    if (!found)
                    {
                        Console.WriteLine($"File not found: {filePath}");
                    }
                }
            }

            MessageBox.Show("Files copied successfully!", "Success", MessageBoxButton.OK, MessageBoxImage.Information);
        }

        private void RadioButton_Path_Checked(object sender, RoutedEventArgs e)
        {
            copyMode = "path";
        }

        private void RadioButton_FileName_Checked(object sender, RoutedEventArgs e)
        {
            copyMode = "filename";
        }
    }
}