# 하베스트 스탠드오프 한글화 (Harvest Standoff 한국어판)

농장 동물 팀 대 농부 팀, 5대5 1인칭 물총 슈터 **Harvest Standoff**의 비공식 한글화입니다. 다치는 사람은 없고, 엉망진창만 있을 뿐이에요.

- **바로 플레이**: https://sigco3111.github.io/harvest-standoff-ko/ (키보드와 마우스가 있는 컴퓨터의 최신 Chrome / Edge / Firefox / Safari)
- 기본 언어는 한국어이고, 메인 메뉴 오른쪽 위의 **한국어 / English** 버튼으로 바꿀 수 있어요. 선택은 브라우저에 저장돼요.
- 로딩 시 외부 서버(글꼴 CDN, 분석 도구 등)를 부르지 않아요. 글꼴 Lilita One / Nunito 는 저장소 안에 들어 있고, 한글은 시스템 글꼴(Pretendard, Noto Sans KR, Apple SD Gothic Neo, 맑은 고딕)로 표시돼요.

## 알림 (NOTICE)

- **원작**: Harvest Standoff — 제작자 [andreteow](https://github.com/andreteow)
- **원작 저장소**: https://github.com/andreteow/farm-ca (원작 사이트: https://harvest-standoff.vercel.app/)
- **한글화 기준 커밋**: `05c9c5f76f01bd65d0576388edb3ff4fcad40488` ("Add a second game mode: Last Team Standing")
- 이 저장소는 **비공식 한글화**이며 원작자와 아무 관련이 없고, 원작자의 승인을 받은 것이 아니에요.
- 한글화 시점에 원작 저장소에는 **라이선스 파일이 없었어요.** 그래서 이 저장소는 어떤 라이선스도 주장하지 않고 LICENSE 파일도 넣지 않았어요. 게임의 코드·그림·소리에 대한 권리는 모두 원작자에게 있어요.
- 원작자에게 공로(크레딧)를 밝혔고, **권리자가 요청하면 이 한글화는 즉시 내리겠습니다.** 문의는 이 저장소의 Issues 로 남겨 주세요.

## 바뀐 점

- 새 언어 시스템: `src/i18n.js` (`t('키')` 조회, 언어 선택을 `localStorage` 의 `hs-lang` 에 저장), 사전 `src/lang-ko.js`, `src/lang-en.js`
- 메인 메뉴·게임 방식·맵·난이도 선택, 키 안내, 일시정지, 경기 종료, 라운드 배너, HUD(점수·체력·무기·코인·상점·상태 표시·안내 문구), 킬 피드, 캐릭터 이름까지 한국어로 번역 (영어도 그대로 선택 가능)
- 한글 글꼴 목록 추가와 줄바꿈(`word-break: keep-all`), 글줄 높이 조정 (`src/page.html`)
- 메인 메뉴 아래쪽 크레딧 줄과 언어 전환 버튼 추가
- `build.mjs`: 결과물을 저장소 맨 위(`index.html`, `vendor/`, `assets/audio.mp3`)에 만들도록 바꿔 GitHub Pages(main / root)에서 바로 서비스해요. 원래 방식은 `node build.mjs --out=dist`
- `package.json` / `package-lock.json`: 원작의 자동 기본값 `ISC` 를 `UNLICENSED` 로 바꿨어요. (이 저장소는 어떤 라이선스도 주장하지 않아요.)
- 아직 영어 그대로인 것: 해설·무전 음성(오디오), 로고 이미지 속 글자

## 직접 빌드하기

```bash
npm install
node build.mjs
```

원작 저장소의 `assets/audio` 폴더(효과음 원본 mp3)를 같은 자리에 복사해 두어야 해요. `index.html` 이 새로 만들어져요. (`three` 는 `npm install` 로 받아 `vendor/three.min.js` 로 복사돼요.)

작업 메모와 남은 일(K2)은 [NOTES.md](NOTES.md) 에 있어요.
