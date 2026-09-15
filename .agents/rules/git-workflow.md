# Git Workflow Rules

Khi hoàn thành một task, hãy tuân thủ quy trình:
1. Tạo feature branch: `feature/<task-name>` hoặc `fix/<task-name>`.
2. Commit message theo format: `<type>(<scope>): <subject>` (Conventional Commits).
3. Merge vào `main` chỉ khi test/lint vượt qua (nếu có script test).
4. Luôn pull `main` mới nhất trước khi merge để tránh conflict.
