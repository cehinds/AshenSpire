; desktop/windows/installer.nsi — the Ashen Spire Windows installer (NSIS 3).
;
; Built by desktop/windows/build-installer.mjs, which stages the files and passes
; every value below with -D; do not run makensis on this file by hand.
;
; Pages: welcome · licence · components · folder · install · finish (launch).
; Components:
;   Ashen Spire (required)        the game, with the light art and the music
;   High-resolution art           downloaded from the pinned art release during
;                                 the install, checked file by file (fetch-hd-art.ps1)
;   Desktop shortcut
; Installs per user (no administrator prompt) into %LOCALAPPDATA%\Programs\Ashen Spire.
; Running it again upgrades in place; unticking the art there removes it.

!macro Need NAME
  !ifndef ${NAME}
    !error "${NAME} is not defined — build with: node desktop/windows/build-installer.mjs"
  !endif
!macroend
!insertmacro Need VERSION
!insertmacro Need APP_DIR
!insertmacro Need UNINSTALL_LIST
!insertmacro Need LICENSE_FILE
!insertmacro Need OUTFILE
!insertmacro Need HD_URL
!insertmacro Need HD_SHA256
!insertmacro Need HD_MB
!insertmacro Need HD_SIZE_KB
!insertmacro Need BASE_SIZE_KB

Unicode true
ManifestDPIAware true
SetCompressor /SOLID lzma
RequestExecutionLevel user

!define APP_NAME "Ashen Spire"
!define APP_EXE "AshenSpire.exe"
!define PUBLISHER "cehinds"
!define UNINST_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\AshenSpire"
!define PS_EXE "$SYSDIR\WindowsPowerShell\v1.0\powershell.exe"
!define PS_SCRIPT "$INSTDIR\install-data\fetch-hd-art.ps1"

Name "${APP_NAME}"
OutFile "${OUTFILE}"
InstallDir "$LOCALAPPDATA\Programs\${APP_NAME}"
InstallDirRegKey HKCU "${UNINST_KEY}" "InstallLocation"
BrandingText "${APP_NAME} ${VERSION}"

VIProductVersion "${VERSION}"
VIAddVersionKey "ProductName" "${APP_NAME}"
VIAddVersionKey "ProductVersion" "${VERSION}"
VIAddVersionKey "FileVersion" "${VERSION}"
VIAddVersionKey "FileDescription" "${APP_NAME} installer"
VIAddVersionKey "CompanyName" "${PUBLISHER}"
VIAddVersionKey "LegalCopyright" "MIT License"

!include "MUI2.nsh"
!include "LogicLib.nsh"
!include "Sections.nsh"

!define MUI_ABORTWARNING
!define MUI_COMPONENTSPAGE_SMALLDESC
!define MUI_WELCOMEPAGE_TEXT "This will install ${APP_NAME} ${VERSION} on your computer.$\r$\n$\r$\nOn the next pages you can choose whether to download the high-resolution art (about ${HD_MB} MB). Without it the game plays with its standard art, and you can add it later by running this installer again.$\r$\n$\r$\nClick Next to continue."
!define MUI_FINISHPAGE_RUN "$INSTDIR\${APP_EXE}"
!define MUI_FINISHPAGE_RUN_TEXT "Play ${APP_NAME} now"

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_LICENSE "${LICENSE_FILE}"
!insertmacro MUI_PAGE_COMPONENTS
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

!insertmacro MUI_LANGUAGE "English"

; ---- the game ------------------------------------------------------------------
; A running game holds its files open, and the section below deletes the old
; version before it copies the new one: close it first, or stop before anything
; is touched.
; 1 when $INSTDIR holds an earlier Ashen Spire install (the folder this
; installer registered), so its files may be cleaned up; 0 on a first install,
; where nothing already in the folder is touched.
Var Upgrade

!macro CloseRunningGame UN
  nsExec::ExecToStack '"$SYSDIR\cmd.exe" /c tasklist /FI "IMAGENAME eq ${APP_EXE}" /NH | find /I "${APP_EXE}"'
  Pop $0
  Pop $1
  ${If} $0 == 0
    MessageBox MB_OKCANCEL|MB_ICONEXCLAMATION "${APP_NAME} is running. Click OK to close it and continue (your progress is saved as you play), or Cancel to stop." /SD IDOK IDOK close_${UN}
      Abort
    close_${UN}:
    nsExec::Exec '"$SYSDIR\taskkill.exe" /F /IM ${APP_EXE}'
    Pop $0
    Sleep 1500
  ${EndIf}
!macroend

Section "Ashen Spire (required)" SecGame
  SectionIn RO
  !insertmacro CloseRunningGame ""

  ; An upgrade: the old version's pack indexes and install data go (so the high
  ; index is back only if the art is installed again); every other file is
  ; overwritten. game\objects\ is kept: its files are named by their content, so
  ; an unchanged high-res file is not downloaded again, and the prune step at the
  ; end removes the objects nothing uses any more. Only files the installer
  ; writes are named here.
  SetOutPath "$INSTDIR"
  StrCpy $Upgrade 0
  ReadRegStr $0 HKCU "${UNINST_KEY}" "InstallLocation"
  ${If} $0 == $INSTDIR
  ${AndIf} ${FileExists} "$INSTDIR\${APP_EXE}"
    StrCpy $Upgrade 1
    ; Before anything is copied: delete what the old version installed and this
    ; one does not (its files.txt against ours), so a path that changes between
    ; file and folder can be written.
    InitPluginsDir
    CopyFiles /SILENT "$INSTDIR\install-data\files.txt" "$PLUGINSDIR\old-files.txt"
    File "/oname=$PLUGINSDIR\new-files.txt" "${APP_DIR}/install-data/files.txt"
    File "/oname=$PLUGINSDIR\fetch-hd-art.ps1" "${APP_DIR}/install-data/fetch-hd-art.ps1"
    nsExec::ExecToLog '"${PS_EXE}" -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "$PLUGINSDIR\fetch-hd-art.ps1" -Mode Drop -InstallDir "$INSTDIR" -OldFiles "$PLUGINSDIR\old-files.txt" -NewFiles "$PLUGINSDIR\new-files.txt"'
    Pop $0
  ${EndIf}

  File /r "${APP_DIR}/*.*"

  ; The desktop shortcut is the optional section's to make again.
  Delete "$DESKTOP\${APP_NAME}.lnk"

  WriteUninstaller "$INSTDIR\Uninstall.exe"
  CreateDirectory "$SMPROGRAMS\${APP_NAME}"
  CreateShortcut "$SMPROGRAMS\${APP_NAME}\${APP_NAME}.lnk" "$INSTDIR\${APP_EXE}"
  CreateShortcut "$SMPROGRAMS\${APP_NAME}\Uninstall ${APP_NAME}.lnk" "$INSTDIR\Uninstall.exe"

  WriteRegStr HKCU "${UNINST_KEY}" "DisplayName" "${APP_NAME}"
  WriteRegStr HKCU "${UNINST_KEY}" "DisplayVersion" "${VERSION}"
  WriteRegStr HKCU "${UNINST_KEY}" "Publisher" "${PUBLISHER}"
  WriteRegStr HKCU "${UNINST_KEY}" "DisplayIcon" "$INSTDIR\${APP_EXE}"
  WriteRegStr HKCU "${UNINST_KEY}" "InstallLocation" "$INSTDIR"
  WriteRegStr HKCU "${UNINST_KEY}" "UninstallString" '"$INSTDIR\Uninstall.exe"'
  WriteRegStr HKCU "${UNINST_KEY}" "QuietUninstallString" '"$INSTDIR\Uninstall.exe" /S'
  WriteRegDWORD HKCU "${UNINST_KEY}" "NoModify" 1
  WriteRegDWORD HKCU "${UNINST_KEY}" "NoRepair" 1
SectionEnd

; ---- high-resolution art (download) ----------------------------------------------
Section "High-resolution art (download, about ${HD_MB} MB)" SecHD
  AddSize ${HD_SIZE_KB}
  DetailPrint "Getting the high-resolution art (about ${HD_MB} MB) — this can take a few minutes."
  nsExec::ExecToLog '"${PS_EXE}" -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "${PS_SCRIPT}" -Mode Install -InstallDir "$INSTDIR" -Url "${HD_URL}" -Sha256 "${HD_SHA256}"'
  Pop $0
  ${If} $0 != 0
    DetailPrint "High-resolution art was not installed (code $0)."
    MessageBox MB_OK|MB_ICONEXCLAMATION "The high-resolution art could not be installed (code $0; the details are in the list behind this message).$\r$\n$\r$\n${APP_NAME} is installed and plays with its standard art. To try again, run this installer again with the high-resolution art ticked." /SD IDOK
  ${EndIf}
SectionEnd

Section "Desktop shortcut" SecDesktop
  CreateShortcut "$DESKTOP\${APP_NAME}.lnk" "$INSTDIR\${APP_EXE}"
SectionEnd

; Last: drop art files no installed pack lists (the high-res art after it
; was unticked, an older version's files). A failure here only costs disk space.
Section "-Prune"
  ; Only an upgrade can leave objects behind; a first install prunes nothing.
  ${If} $Upgrade == 1
    nsExec::ExecToLog '"${PS_EXE}" -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "${PS_SCRIPT}" -Mode Prune -InstallDir "$INSTDIR"'
    Pop $0
  ${EndIf}
  ; The estimated size Windows shows under Installed apps.
  ${If} ${FileExists} "$INSTDIR\game\packs\high-*.json"
    IntOp $1 ${BASE_SIZE_KB} + ${HD_SIZE_KB}
  ${Else}
    StrCpy $1 ${BASE_SIZE_KB}
  ${EndIf}
  WriteRegDWORD HKCU "${UNINST_KEY}" "EstimatedSize" $1
SectionEnd

; An upgrade keeps the player's earlier choice: the art box starts unticked when
; the installed game has no high-resolution art.
Function .onInit
  ReadRegStr $0 HKCU "${UNINST_KEY}" "InstallLocation"
  ${If} $0 != ""
  ${AndIf} ${FileExists} "$0\${APP_EXE}"
  ${AndIfNot} ${FileExists} "$0\game\packs\high-*.json"
    !insertmacro UnselectSection ${SecHD}
  ${EndIf}
FunctionEnd

!insertmacro MUI_FUNCTION_DESCRIPTION_BEGIN
  !insertmacro MUI_DESCRIPTION_TEXT ${SecGame} "The game, with its standard art and the music."
  !insertmacro MUI_DESCRIPTION_TEXT ${SecHD} "Downloads the full-resolution art (about ${HD_MB} MB) during the install and checks every file. Untick to play with the standard art; run the installer again later to add it."
  !insertmacro MUI_DESCRIPTION_TEXT ${SecDesktop} "Puts an ${APP_NAME} shortcut on the desktop."
!insertmacro MUI_FUNCTION_DESCRIPTION_END

; ---- uninstall ---------------------------------------------------------------------
Section "Uninstall"
  !insertmacro CloseRunningGame "un"
  ; Exactly the files the installer wrote, then the folder only if it is empty:
  ; nothing the player put there is removed.
!include "${UNINSTALL_LIST}"
  Delete "$INSTDIR\Uninstall.exe"
  RMDir "$INSTDIR"

  Delete "$DESKTOP\${APP_NAME}.lnk"
  Delete "$SMPROGRAMS\${APP_NAME}\${APP_NAME}.lnk"
  Delete "$SMPROGRAMS\${APP_NAME}\Uninstall ${APP_NAME}.lnk"
  RMDir "$SMPROGRAMS\${APP_NAME}"
  DeleteRegKey HKCU "${UNINST_KEY}"

  ; Saves and settings live in %APPDATA%\AshenSpire (the Electron profile); they
  ; are kept unless the player asks, so a reinstall finds them.
  MessageBox MB_YESNO|MB_ICONQUESTION|MB_DEFBUTTON2 "Also delete your saved games and settings?" /SD IDNO IDNO keepSaves
    RMDir /r "$APPDATA\AshenSpire"
  keepSaves:
SectionEnd
