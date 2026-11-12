# 한글화 작업 노트 (NOTES)

기준: 원작 `andreteow/farm-ca` 커밋 `05c9c5f76f01bd65d0576388edb3ff4fcad40488`. 이 문서는 작업자용 메모예요.

## 용어집 (일관되게 쓰기)

| 영어 | 한국어 |
|---|---|
| The Herd / Herd | 동물 팀 / 동물 |
| The Hands / Farmhands | 농부 팀 / 농부 |
| Round / Match | 라운드 / 경기 |
| Farm Shop / shop | 농장 상점 / 상점 |
| Corn coins | 옥수수 코인 |
| Stink-Pumpkin | 악취 호박 |
| Cork / corking | 코르크로 막기 |
| Plant | 심기 |
| Splat / splatted | 맞히기 / 맞아서 아웃 |
| Last Team Standing | 최후의 한 팀 |
| Site A / B | A 구역 / B 구역 |
| Easy / Medium / Hard | 쉬움 / 보통 / 어려움 |

말투: 어린이도 읽기 쉬운 `~해요` 체. 한 줄이 길어지지 않게 짧게. 영어 약어(E, B, V 같은 키 이름)는 그대로 둠.

## K1 상태 (완료)

- 언어 시스템: `src/i18n.js`, 사전 `src/lang-ko.js` / `src/lang-en.js` (K1 때 각 180개 키, 지금은 247개). 선택은 `localStorage` 의 `hs-lang`.
- 번역됨: 메인 메뉴(게임 방식·팀·맵·난이도·키 안내·크레딧), 일시정지(마우스 속도·소리 크기), 경기 종료, 라운드 배너와 이유 문구, HUD 라벨, 상태·안내 문구, 킬 피드, 상점(품목 이름·설명 포함), 처음 안내(tip), 관전 문구, 캐릭터 이름.
- 글꼴: 라틴 글자는 저장소 안의 Lilita One / Nunito, 한글은 시스템 글꼴 `Pretendard, Noto Sans KR, Apple SD Gothic Neo, Malgun Gothic, Nanum Gothic` 순 (외부 요청 없음).
- 줄 넘침 검사: 1920x1080 ~ 800x600, 한국어/영어, 메인 메뉴·일시정지·상점·배너·상태 줄 모두 넘침 없음.
- 빌드: `assets/audio` 원본 mp3(원작 저장소에 있음)는 이 저장소에 없어서, 다시 빌드하려면 원작의 `assets/audio` 를 복사해야 해요. 빌드 결과(`index.html`, `vendor/`, `assets/audio.mp3`)는 이미 들어 있어요.

## K2 상태 (완료)

- 영어 문구 정리: `src/config.js` / `src/world.js` 의 이름·설명·난이도 라벨 등 사용되지 않던 영어 문구를 삭제(문구는 `lang-*.js` 만 사용), `src/page.html` 의 기본 글자는 한국어로 바꿈. `ROSTER[].name` 은 사전 키(`name.<이름>`)라서 영어 그대로 둠.
- 숫자 표기: `i18n.js` 의 `fmt()` 가 한국어 `ko-KR`, 영어 `en-US` 를 따라감(`src/hud.js`).
- 언어 전환: 메인 메뉴와 일시정지 화면 둘 다(`.lang-sw` 버튼). 자막 켬/끔도 둘 다(`.subs-sw`).
- 로고 한글 제목: `.logo-sub` (HTML 글자, 영어 모드에서는 숨김).
- 자막: `src/subtitles.js`. `src/audio.js` 의 `sample()` 에서 `ann_*`, `herd_*`, `hands_*` 음성이 실제로 재생될 때 호출(들리는 거리 `vol >= 0.15`). 58개 모두 `vo.<파일이름>` 키가 있고, 게임 코드가 실제로 부르지 않는 것은 `ann_go`, `herd_refill`, `hands_refill` 3개. 같은 화자의 새 줄이 이전 줄을 대체하고, 길이는 소리 길이 + 0.4초.
- 확인용: 브라우저 콘솔에서 `__hs.audio.announce('ann_lts')` (페이지를 한 번 클릭한 뒤), 또는 `__hs.subtitles.show('herd_nice', 2)`.
- 대본 출처: 원작 `tools/audio/batch.py` 의 `VOICE`. batch.py 에 없는 6개(`herd_/hands_` 의 `flour`, `mud`, `rooster`)는 음성 인식으로 확인해 'Flour bomb!', 'Mud balloon!', 'Rooster away! Look out!' 으로 적었어요(mud 는 인식이 불확실해서 원어민 확인 필요).
- 점검: 한국어/영어 키 247개 일치, `{변수}` 일치, 사용하는 키가 모두 있음(`node` 로 확인).
- 말투 점검 결과: 명령문 `~세요`, 서술문 `~해요/예요` 로 해요체 통일. HUD 짧은 라벨(예: '악취 호박 운반 중: 이름')은 명사형 유지. '지도'를 '미니맵'으로 통일. `{team}이/의` 조사는 팀 이름이 모두 '팀'으로 끝나서 문제 없음.

## 아직 남은 일

| 항목 | 위치 |
|---|---|
| 한국어 문구 전체 다듬기(원어민 검수) 247키 | `src/lang-ko.js` |
| 음성 자체의 한국어 더빙(자막만 있음) | `assets/audio` |
| 로고 이미지 속 영어 글자(그림 그대로, 한글 제목을 HTML로 덧붙임) | `assets/ui/logo.jpg` |
| 동물 울음소리 5개 자막 없음 | `noise_*` |
| 휴대폰·태블릿 지원 | 원작도 미지원 |

용어집 추가: 미니맵(레이더), 자막, 언어.

## 올리기 메모

- 웹 업로더는 파일 이름을 소문자로 바꾸고 한 번에 폴더 하나만 올려요. 대문자 파일(`README.md`, `NOTES.md`)은 웹 편집기로.
- 커밋 메시지는 `게임: ` / `문서: ` 로 시작. 라이선스 파일은 넣지 않아요.
