@echo off
cd /d C:\sattva
(
echo node_modules/
echo dist/
echo .env
echo .env.local
echo src/App.jsx.bak
echo migrate_to_router.py
echo fix_jsx.py
echo set_secret.bat
echo .claude/
) > .gitignore
git add .gitignore
git commit -m "Add .claude/ to gitignore"
git push
echo DONE
