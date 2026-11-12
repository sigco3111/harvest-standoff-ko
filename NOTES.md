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

- 언어 시스템: `src/i18n.js`, 사전 `src/lang-ko.js` / `src/lang-en.js` (각 180개 키, 서로 일치). 선택은 `localStorage` 의 `hs-lang`.
- 번역됨: 메인 메뉴(게임 방식·팀·맵·난이도·키 안내·크레딧), 일시정지(마우스 속도·소리 크기), 경기 종료, 라운드 배너와 이유 문구, HUD 라벨, 상태·안내 문구, 킬 피드, 상점(품목 이름·설명 포함), 처음 안내(tip), 관전 문구, 캐릭터 이름.
- 글꼴: 라틴 글자는 저장소 안의 Lilita One / Nunito, 한글은 시스템 글꼴 `Pretendard, Noto Sans KR, Apple SD Gothic Neo, Malgun Gothic, Nanum Gothic` 순 (외부 요청 없음).
- 줄 넘침 검사: 1920x1080 ~ 800x600, 한국어/영어, 메인 메뉴·일시정지·상점·배너·상태 줄 모두 넘침 없음.
- 빌드: `assets/audio` 원본 mp3(원작 저장소에 있음)는 이 저장소에 없어서, 다시 빌드하려면 원작의 `assets/audio` 를 복사해야 해요. 빌드 결과(`index.html`, `vendor/`, `assets/audio.mp3`)는 이미 들어 있어요.

## K2 남은 일

| 항목 | 개수 | 위치 |
|---|---|---|
| 음성 대사(영어 그대로): 해설 16 + 농부 무전 22 + 동물 무전 20 | 58개 (소리 파일) | 원작 `assets/audio/ann_*`, `hands_*`, `herd_*` (이 저장소엔 `assets/audio.mp3` 한 묶음). 대본은 원작 `tools/audio/batch.py`. 한글 자막 또는 한국어 음성 필요 |
| 글자가 들어간 그림: 로고(영어 "HARVEST STANDOFF"). 키아트·공유 그림엔 글자 없음 | 1개 | `assets/ui/logo.jpg` |
| 일시정지 화면에서 언어 바꾸기 | 1개 | `src/page.html`, `src/main.js` (지금은 메인 메뉴에서만 바꿀 수 있어요) |
| 영어 원문이 코드에 남은 곳(사전에 키가 있어 화면엔 안 보임, 정리용) | 28줄 | `src/config.js`, `src/world.js`, `src/page.html` 기본값 |
| 숫자 표기 `toLocaleString('en-US')` (코인 수 쉼표) | 1곳 | `src/hud.js` |
| 한국어 문구 전체 다듬기(원어민 검수) | 180키 | `src/lang-ko.js` |
| 휴대폰·태블릿 안내(터치 미지원 문구만 번역됨) | 1개 | 원작도 미지원 |

## 올리기 메모

- 웹 업로더는 파일 이름을 소문자로 바꾸고 한 번에 폴더 하나만 올려요. 대문자 파일(`README.md`, `NOTES.md`)은 웹 편집기로.
- 커밋 메시지는 `게임: ` / `문서: ` 로 시작. 라이선스 파일은 넣지 않아요.
