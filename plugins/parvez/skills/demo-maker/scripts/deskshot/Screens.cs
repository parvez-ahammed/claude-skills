namespace DeskShot;

// Rewrite for each demo. "Real" constructs today's dialogs from the client's assembly with sample data,
// for example: using var f = new YourClient.Forms.ExportDialog(sampleDto); Program.Save(Program.Snap(f), "real-export.png");
// "New" builds the planned screens from the same control types the client's Designer files use.
internal static class Screens
{
    public static void Real()
    {
    }

    public static void New()
    {
        using var dialog = ExampleDialog(new[] { ("report-a.csv", "Ready"), ("report-b.csv", "Ready"), ("notes.txt", "Not supported") });
        var shot = Program.Snap(dialog);
        Program.Save(File.Exists(Program.Backdrop) ? Program.Composite(new Bitmap(Program.Backdrop), shot) : shot, "new-01-review.png");
    }

    // Plain WinForms placeholder. In a real demo use the client's grid, label and button types instead.
    private static Form ExampleDialog((string Name, string Status)[] rows)
    {
        var form = new Form { Text = "Review files", ClientSize = new Size(520, 260), FormBorderStyle = FormBorderStyle.FixedDialog };
        var grid = new DataGridView
        {
            Dock = DockStyle.Fill, ReadOnly = true, AllowUserToAddRows = false, RowHeadersVisible = false,
            AutoSizeColumnsMode = DataGridViewAutoSizeColumnsMode.Fill,
        };
        // Add columns explicitly: auto-generated columns do not exist until the form has a handle.
        grid.Columns.Add("Name", "File");
        grid.Columns.Add("Status", "Status");
        foreach (var (name, status) in rows) grid.Rows.Add(name, status);

        var buttons = new FlowLayoutPanel { Dock = DockStyle.Bottom, FlowDirection = FlowDirection.RightToLeft, Height = 44, Padding = new Padding(8) };
        buttons.Controls.Add(new Button { Text = "Cancel", AutoSize = true, TabStop = false });
        buttons.Controls.Add(new Button { Text = "Upload", AutoSize = true, TabStop = false });

        form.Controls.Add(grid);
        form.Controls.Add(buttons);
        form.Shown += (_, _) => grid.ClearSelection();
        return form;
    }
}
