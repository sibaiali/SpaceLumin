@echo off
setlocal
echo ============================================================
echo   LUMIN FLOW: UTOPIA RUN - BUILDER (WINDOWS EXE ^& ANDROID)
echo ============================================================

set CSC="C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
if exist %CSC% (
    echo [1/3] Compiling Windows Standalone Executable (SpaceLumin.exe)...
    %CSC% /nologo /target:winexe /win32icon:icons\icon.ico /r:System.Drawing.dll /r:System.Windows.Forms.dll /out:SpaceLumin.exe tools\SpaceLuminDesktop.cs
    echo       Done: SpaceLumin.exe
) else (
    echo [WARN] .NET Framework CSC not found at %CSC%
)

echo [2/3] Syncing WebGL Game Assets into Android WebView Project...
if not exist "android\app\src\main\assets\www" mkdir "android\app\src\main\assets\www"
xcopy /Y /Q index.html "android\app\src\main\assets\www\" >nul
xcopy /Y /Q styles.css "android\app\src\main\assets\www\" >nul
xcopy /Y /Q manifest.json "android\app\src\main\assets\www\" >nul
xcopy /Y /Q sw.js "android\app\src\main\assets\www\" >nul
xcopy /Y /Q favicon.ico "android\app\src\main\assets\www\" >nul
xcopy /E /I /Y /Q js "android\app\src\main\assets\www\js" >nul
xcopy /E /I /Y /Q icons "android\app\src\main\assets\www\icons" >nul
xcopy /E /I /Y /Q lib "android\app\src\main\assets\www\lib" >nul
echo       Done: android\app\src\main\assets\www

echo [3/3] Checking for Android SDK / Gradle...
if exist "%ANDROID_HOME%\platform-tools" (
    echo       Android SDK detected at %ANDROID_HOME%.
    echo       Run "cd android && gradlew assembleRelease" or open "android\" in Android Studio to generate signed APK.
) else (
    echo       Android project ready in .\android\ (Open in Android Studio or run Bubblewrap/Capacitor to sign APK).
)

echo ============================================================
echo   Build Complete! Double-click SpaceLumin.exe to play now.
echo ============================================================
pause
