# phantasy-star-rpg

## Dependencies

### Calibre (MOBI → EPUB conversion)

When a `.mobi` file is uploaded to the Library, the server automatically converts it to EPUB using Calibre's `ebook-convert` CLI so the in-browser viewer can render it. If Calibre is not installed the file is stored as-is and users fall back to downloading it.

**Windows**

1. Download and install Calibre from <https://calibre-ebook.com/download_windows>
2. Add the install directory to the system PATH:
   - Default path: `C:\Program Files\Calibre2\`
   - Open **Control Panel → System → Advanced system settings → Environment Variables**
   - Edit the **Path** variable and add the Calibre directory
3. Restart any open terminals and verify:
   ```
   ebook-convert --version
   ```

**Linux (Ubuntu / Debian)**

```bash
sudo apt install calibre
```

**macOS**

```bash
brew install calibre
```
