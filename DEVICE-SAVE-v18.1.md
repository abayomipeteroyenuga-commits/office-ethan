# ETHAN Office v18.1 — Device Save Upgrade

Implemented:
- Autosave still preserves the editable working file inside ETHAN Office.
- Manual Save now also creates a copy on the user's computer, phone or tablet.
- File System Access API is used where supported so the user can choose a folder and filename.
- Other browsers/mobile devices fall back to the normal Downloads folder.
- Word device copy: .doc
- Excel device copy: .xls-compatible workbook
- Presentation device copy: editable .ethanpresentation package
- My Office Files remains the central in-app file page.
- My Office Files now includes a Save to Device action for Word, Excel and Presentation.
- Device-save timestamps are displayed for files that have been copied to the device.
- Autosave does not repeatedly trigger downloads.
