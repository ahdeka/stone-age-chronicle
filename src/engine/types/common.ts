/** 모든 콘텐츠 id. 유효성은 엔진 타입이 아니라 콘텐츠 검증기가 확인한다. */
export type Id = string;

/** 화면에 보일 이름. 엔진은 문자열을 만들지 않고 키나 원문만 들고 다닌다. */
export type Label = { key: string } | { raw: string };
