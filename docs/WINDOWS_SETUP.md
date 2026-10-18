# Windows Setup & Verification Guide for AuraZ

Tested on a Windows machine by **Jyothi Rodrigues** for the **IBM Z Datathon 2026**.

This guide records the exact setup steps, verified commands, system versions, real outputs, and observed Windows-specific issues and fixes for running AuraZ locally on Windows.

---

## 1. System Environment & Versions Tested

| Component | Tested Version | Notes |
|---|---|---|
| **OS** | Windows 11 (`Microsoft Windows NT 10.0.26200.0`, AMD64) | Tested in PowerShell |
| **Node.js** | `v24.19.0` | Node.js 22+ supported |
| **npm** | `11.17.0` | Uses `npm.cmd` when PowerShell script execution is restricted |
| **Python** | `Python 3.14.6` | Invoked with `python` (Windows does not have `python3` by default) |
| **Git** | `git version 2.55.0.windows.3` | Git for Windows |
| **Browsers** | Google Chrome `155.0.8059.82`, Microsoft Edge `155.0.4283.62` | Verified with dev server & automation |

---

## 2. Step-by-Step Setup Guide for New Windows Contributors

### Step 1: Clone the Repository
```powershell
git clone https://github.com/saksham-2x7/IBM_Z.git
cd IBM_Z
```

### Step 2: Configure Git Identity & Switch Branch
```powershell
git config user.name "Your Name"
git config user.email "your.email@example.com"
git switch -c your-branch-name
```

### Step 3: Install Node Dependencies (`npm ci`)
```powershell
npm ci
```
*Note for Windows users:* If PowerShell displays a `PSSecurityException` error (`npm.ps1 cannot be loaded because running scripts is disabled`), either run `npm.cmd ci` or run PowerShell with `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned`.

**Actual output observed:**
```text
added 100 packages, and audited 101 packages in 25s
16 packages are looking for funding
found 0 vulnerabilities
```

### Step 4: Run Application Tests (`npm test`)
```powershell
npm test
```
**Actual output observed:**
```text
> auraz-ibm-z@1.0.0 test
> vitest run

 RUN  v5.0.5 C:/Users/Jyothi Rodrigues/.gemini/antigravity/scratch/IBM_Z

 ✓ tests/model.test.ts (28 tests) 59ms

 Test Files  1 passed (1)
      Tests  28 passed (28)
   Duration  342ms (transform 45%, tests 31%, import 21%, worker 2%)
```
All 28 Vitest tests passed cleanly.

### Step 5: Run Python Inference Server Unit Tests
```powershell
python -m unittest ml/test_serve.py
```
*Note for Windows users:* On Windows, use `python` rather than `python3` (which is standard on Linux/macOS).

**Actual output observed:**
```text
......
----------------------------------------------------------------------
Ran 6 tests in 0.689s

OK
```
All 6 tests passed (including health check, scoring batch, single scoring, and FHIR bundle integration).

### Step 6: Start Local Inference Server (`python ml/serve.py 8080`)
Open a new terminal and run:
```powershell
python ml/serve.py 8080
```
**Actual output observed:**
```text
AuraZ inference on Windows [AMD64] machine=None nnpa=False workers=1 -> :8080
```
To verify the health endpoint:
```powershell
Invoke-RestMethod -Uri "http://localhost:8080/health"
```
Returns:
```json
{
  "ok": true,
  "features": 16,
  "real_model": 300,
  "real_features": 108,
  "arch": "AMD64",
  "python": "3.14.6",
  "machine": "",
  "nnpa": false,
  "system": "Windows"
}
```

### Step 7: Start the Frontend Dev Server (`npm run dev`)
In another terminal, run:
```powershell
npm run dev
```
**Actual output observed:**
```text
> auraz-ibm-z@1.0.0 dev
> vite

  VITE v6.4.4  ready in 558 ms

  ➜  Local:   http://localhost:5174/
  ➜  Network: use --host to expose
```
Open `http://localhost:5174` in your browser (Google Chrome or Microsoft Edge).

### Step 8: Connect the Dashboard to the Local Inference Server
1. In the browser, navigate to the **IBM Z** tab.
2. In the endpoint text box, enter `http://localhost:8080`.
3. Click the **Connect** button.
4. **Result:** The connection pill displays `connected · Windows · AMD64` with a green indicator dot.
5. Click **Benchmark remote (40 requests)**.
6. The dashboard executes 40 consecutive requests against `http://localhost:8080/score` and confirms exact parity with the in-browser model (`Max |remote − local| = 0.0`).

---

## 3. Common Windows Issues & Fixes

1. **`python3` is not recognized**
   - **Problem:** Commands in `README.md` and helper scripts use `python3`, which is standard on macOS and Linux. On Windows, the binary is typically named `python.exe`.
   - **Fix:** Run `python` instead of `python3`, or create a symlink / PowerShell alias: `Set-Alias -Name python3 -Value python`.

2. **PowerShell script execution policy blocks `npm` / `npx`**
   - **Problem:** Running `npm` or `npx` can fail with: `File C:\Program Files\nodejs\npm.ps1 cannot be loaded because running scripts is disabled`.
   - **Fix:** Call `npm.cmd` / `npx.cmd`, or enable local script execution with:
     ```powershell
     Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
     ```

3. **Bash scripts (`.sh`) cannot run natively in PowerShell**
   - **Problem:** Scripts like `scripts/run_full_pipeline.sh` require a POSIX shell.
   - **Fix:** On Windows, run individual Python commands directly (`python ml/...`), or execute bash scripts via Git Bash (`"C:\Program Files\Git\bin\bash.exe" scripts/...`) or WSL.

4. **Hard-coded macOS paths in helper scripts**
   - **Problem:** Helper scripts under `scripts/` previously hardcoded `/Applications/Google Chrome.app/...`.
   - **Fix:** Use environment variable `CHROME_PATH`, or point to `C:\Program Files\Google\Chrome\Application\chrome.exe` or `C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`.
