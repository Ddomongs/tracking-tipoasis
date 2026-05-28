# Deploy Request Template

Use this message when asking the assistant to deploy:

```text
배포 진행해줘. DEPLOYMENT.md의 "CloudLinux Safe Deploy (Next.js standalone)" 규칙을 반드시 따르고,
먼저 `npm run package:cloudlinux`를 실행해서 배포 파일을 생성해줘.
완료 후 아래 4가지를 보고해줘:
1) 업로드 파일명
2) 루트 node_modules 미포함 검증 결과
3) startup file 확인 결과(.next/standalone/server.js)
4) 접속 확인 결과(503 여부, 스타일 정상 여부)
```

Quick recovery command (server):

```bash
cd /home/kcom/tracking
rm -rf node_modules .next public
tar -xzf tracking-cloudlinux-fixed-YYYY-MM-DD.tar.gz
```
