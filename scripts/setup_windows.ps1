#Requires -RunAsAdministrator
function Test-Administrator
{  
    $user = [Security.Principal.WindowsIdentity]::GetCurrent();
    (New-Object Security.Principal.WindowsPrincipal $user).IsInRole([Security.Principal.WindowsBuiltinRole]::Administrator)  
}
if(-not (Test-Administrator))
{
    Write-Error "This script must be executed as Administrator.";
    exit 1;
}

function Check-Python($python) {
	if (Get-Command $python -ErrorAction SilentlyContinue) {
		try {
			$ver = .$python "--version" | Out-String
			$ver = $ver.Substring("Python ".Length)
			$ver = [System.Version]::Parse($ver)
			return ($python, $ver)
		} catch {
			# the fact that we found python3 cmd doesn't mean it's real Python3, it can be some stupid shortcut for Microsoft Store
		}
	}
}
function Find-Python {
	$p = Check-Python("python3.exe")
	if ($p) { return $p }
	$p = Check-Python("python.exe")
	if ($p) { return $p }
}

Install-PackageProvider ChocolateyGet
Import-PackageProvider ChocolateyGet -Force

# Installing dependencies
$deps = @{
	python3 = 3.7
	# nodejs = 12.0
	git = 2.1
}
foreach ($h in $deps.GetEnumerator()) {
    $packageName = $h.Name
    $version = $h.Value
    Write-Host -ForegroundColor DarkGray "Checking $packageName (>=$version)"
    $package = Get-Package $packageName -MinimumVersion $version -Provider ChocolateyGet -ErrorAction SilentlyContinue
	if (-not $package) {
		Write-Host -ForegroundColor DarkGray "$package not found, installing..."
		Install-Package -Name $packageName -Verbose -Provider ChocolateyGet -AcceptLicense
	} else {
		Write-Host -ForegroundColor Green "    Found" $package.Name ":" $package.Version
	}
}


# Downloading updated application
$github_repo_url = "https://github.com/google/assetMG.git"
if (Test-Path "assetMG") {
	Write-Host -ForegroundColor DarkGray "Downloading application"
	cd assetMG
	git pull
} else {
	Write-Host -ForegroundColor DarkGray "Downloading updated application"
	git clone $github_repo_url
	cd assetMG
}
# NOTE: we're now inside 'assetMG' folder


# Detecting the name of Python executable (it's either 'python' or 'python3')
#	NOTE: we can check version as well, but we already did it above 
#	NOTE: but here we're implicitly supposing that executable 'python' comes from 
#   NOTE: an installation corresponds to ChocoGet package installed/checked above
($python, $ver) = Find-Python
# Creating Python virtual environment
Write-Host -ForegroundColor DarkGray "Creating virtual environment"
. $python -m venv .venv
. .\.venv\Scripts\Activate.ps1 

# Installing dependencies via pip
Write-Host -ForegroundColor DarkGray "Installing Python dependencies"
. $python -m pip install -r requirements.txt

if( $LASTEXITCODE -ne 0 ) {
	Write-Host -ForegroundColor Red "An error occured during python dependencies installation, please investigate"
}


# Installing frontend dependencies
# Write-Host -ForegroundColor DarkGray "Building front-end application"
# cd app/asset_browser/frontend
# npm install
# node_modules/.bin/ng build
# cd ../../..


# Generating run scripts
# NOTE: we're till inside 'assetMG' folder
Write-Host -ForegroundColor DarkGray "Generating run scripts"
"git fetch
`$local  = git rev-parse '@'
`$remote = git rev-parse '@{u}'
`$base   = git merge-base '@' '@{u}'
if (`$local -eq `$remote) {
	Write-Host -ForegroundColor Green 'Project is up-to-date'
} elseif (`$local -eq `$base) {
	Write-Host 'Project needs to be refreshed'
	git pull

  	. .\.venv\Scripts\Activate.ps1 
  	. $python -m pip install -r requirements.txt

}
. .\.venv\Scripts\Activate.ps1
. $python ./main.py
" | out-file ./win_run.ps1 -encoding ascii

"powershell -ExecutionPolicy bypass -File ./win_run.ps1"  | out-file ./win_run.cmd -encoding ascii

# Creating a shortcut on desktop to run the cmd script
$DesktopPath = [Environment]::GetFolderPath("Desktop")
$ShCutLnk = "Google AssetMG.lnk"
$WshShell = New-Object -comObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut("$DesktopPath\$ShCutLnk")
$Shortcut.TargetPath = "C:\Windows\System32\windowspowershell\v1.0\powershell.exe"
$Shortcut.IconLocation = "C:\Windows\System32\windowspowershell\v1.0\powershell.exe,0" # icon index 0
$targetPath = (Resolve-Path ./win_run.ps1).Path
$Shortcut.Arguments = "-Nop -Executionpolicy bypass -NoExit ""$targetPath"""
$Shortcut.WorkingDirectory = (Resolve-Path .).Path
$Shortcut.Save()

Write-Host -ForegroundColor Green "All done, to start the app please run win_run.cmd or $python main.py"
