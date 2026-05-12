@echo off
cd /d C:\sattva
git rm --cached .claude/worktrees/adoring-cori-a08994
git rm --cached .claude/worktrees/stupefied-wilbur-a74839
git rm --cached .claude/worktrees/sweet-albattani-d87858
git add .gitignore
git commit -m "Remove Claude worktrees from tracking, add .claude to gitignore"
git push
echo DONE
