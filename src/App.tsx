/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Copy, CheckCircle2, AlertCircle, XCircle, BookOpen, PenTool, Package, Filter, Activity, FileText, Layers, Swords } from 'lucide-react';

function analyzeKeyword(text: string) {
  const t = text.trim();
  if (!t) return null;

  const isQuestion = /방법|기준|대상|조건|차이|이유/.test(t);
  const isActionable = /신청|조회|계산|확인|비교/.test(t);
  const isPolicyIssue = /지원금|정책|금리|환율|논란|전쟁/.test(t);
  const isScalable = /종류|비교|방법|지역별|연령별|조건|대상|기준|특징/.test(t) || t.split(' ').length >= 2;
  const isLongTail = t.split(' ').length >= 3;

  const intentScore = (isQuestion ? 1 : 0) + (isActionable ? 1 : 0) + (isPolicyIssue ? 1 : 0) + (isScalable ? 1 : 0);
  const hasStrongIntent = intentScore >= 2;

  const isHighTraffic = /전망|추천|순위|방법|후기|가격|비교|차이|조회|신청|가이드/.test(t);

  let traffic = '낮음';
  if (isHighTraffic || isPolicyIssue) traffic = '높음';
  else if (t.length > 5) traffic = '중간';

  const hasTraffic = traffic === '높음' || traffic === '중간';

  let intentStrength = hasStrongIntent ? '강함' : '약함';
  let scalability = isScalable ? 'YES' : 'NO';

  let competition = '높음';
  if (isLongTail) competition = '낮음';
  else if (t.length > 8 || isScalable) competition = '중간';

  const hasRequiredAction = /신청|조회|확인|방법|계산|기준/.test(t);
  const isForecastException = /전망|예측|분석/.test(t);

  let decision = 'DROP';
  if (hasTraffic && hasStrongIntent) {
    if (hasRequiredAction || (traffic === '높음' && isForecastException)) {
      decision = 'GO';
    } else {
      decision = 'HOLD';
    }
  } else if ((hasTraffic && !hasStrongIntent) || (!hasTraffic && hasStrongIntent)) {
    decision = 'HOLD';
  }
  
  if (t.length < 2) decision = 'DROP';

  return { traffic, intentStrength, scalability, competition, decision };
}

function analyzeIntent(title: string) {
  if (title.includes('방법') || title.includes('조회')) return '방법형';
  if (title.includes('전망') || title.includes('예측')) return '전망형';
  if (title.includes('차이') || title.includes('비교')) return '비교형';
  if (title.includes('이유') || title.includes('원인')) return '원인형';
  if (title.includes('뜻') || title.includes('정의')) return '정보형';
  return '일반형';
}

function evaluateResponse(jsonStr: string) {
  try {
    const data = JSON.parse(jsonStr);
    const reasons = [];
    let score = 0;

    if (data.latest_criteria && data.latest_criteria.length > 0) {
      score++;
    } else {
      reasons.push('최신 기준 누락');
    }

    if (Array.isArray(data.numerical_data) && data.numerical_data.length > 0) {
      score++;
    } else {
      reasons.push('수치 데이터 누락');
    }

    if (data.policy && data.policy.length > 0) {
      score++;
    } else {
      reasons.push('관련 정책 누락');
    }

    if (data.economic_connection && data.economic_connection.length > 0) {
      score++;
    } else {
      reasons.push('경제 연결(금리/환율/유가/물가 등) 누락');
    }

    if (Array.isArray(data.writing_points) && data.writing_points.length >= 5) {
      score++;
    } else {
      reasons.push('작성 포인트 5개 미만');
    }

    if (Array.isArray(data.risks) && data.risks.length > 0) {
      score++;
    } else {
      reasons.push('리스크 누락');
    }

    let status = '보류';
    if (score === 6) status = '통과';
    else if (score >= 4) status = '조건부 통과';

    return { status, reasons, parsed: data };
  } catch (e) {
    return { status: '보류', reasons: ['유효하지 않은 JSON 형식입니다.'], parsed: null };
  }
}

function CopyButton({ text, dark = false }: { text: string, dark?: boolean }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={handleCopy}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
        dark
          ? 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
          : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200 shadow-sm'
      }`}
    >
      {copied ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
      {copied ? '복사됨' : '복사'}
    </button>
  );
}

export default function App() {
  const [title, setTitle] = useState('');
  const [keywordAnalysis, setKeywordAnalysis] = useState<{traffic: string, intentStrength: string, scalability: string, competition: string, decision: string} | null>(null);
  const [libraryPrompt, setLibraryPrompt] = useState('');
  const [libraryResponse, setLibraryResponse] = useState('');
  const [evaluation, setEvaluation] = useState<{status: string, reasons: string[], parsed: any} | null>(null);
  const [writerPrompt, setWriterPrompt] = useState('');
  const [finalPackage, setFinalPackage] = useState('');

  const handleAnalyzeKeyword = () => {
    setKeywordAnalysis(analyzeKeyword(title));
    setLibraryPrompt('');
    setEvaluation(null);
    setWriterPrompt('');
    setFinalPackage('');
  };

  const handleGenerateLibraryPrompt = () => {
    const intent = analyzeIntent(title);
    const prompt = `주제: "${title}"
검색 의도: ${intent}

위 주제에 대해 리서치하고 반드시 아래 JSON 형식으로만 출력하세요. 설명은 절대 추가하지 마세요.

요구사항:
1. 최신 기준 및 수치 데이터를 반드시 포함할 것
2. 관련 정책이 있다면 실존 여부를 확인할 것
3. 경제 지표(금리/환율/유가/물가)와의 연결성을 분석할 것
4. 작성 포인트는 5개 이상 도출할 것
5. 관련 리스크를 반드시 포함할 것

출력 형식 (JSON):
{
  "topic": "주제",
  "latest_criteria": "최신 기준 설명",
  "numerical_data": ["데이터1", "데이터2"],
  "policy": "관련 정책",
  "economic_connection": "경제 지표 연결 분석",
  "writing_points": ["포인트1", "포인트2", "포인트3", "포인트4", "포인트5"],
  "risks": ["리스크1", "리스크2"]
}`;
    setLibraryPrompt(prompt);
    // Reset subsequent steps
    setEvaluation(null);
    setWriterPrompt('');
    setFinalPackage('');
  };

  const handleEvaluate = () => {
    setEvaluation(evaluateResponse(libraryResponse));
    // Reset subsequent steps
    setWriterPrompt('');
    setFinalPackage('');
  };

  const handleGenerateWriterPrompt = () => {
    const prompt = `글 목적: 제공된 리서치 데이터를 바탕으로 객관적이고 신뢰성 있는 정보 전달
제목: "${title}"

아래 제공된 [리서치 데이터]를 기반으로 블로그/기사 원문을 작성하세요.

작성 규칙:
1. 데이터 기반으로 작성할 것
2. 금지 표현: 과장된 표현, 근거 없는 추측
3. 글 구조: 도입 → 데이터 → 해석 → 리스크 → 결론
4. 하단에 반드시 면책 문구를 포함할 것 ("본 글은 정보 제공 목적으로 작성되었으며, 투자 권유나 법적 책임을 지지 않습니다.")`;
    setWriterPrompt(prompt);
    setFinalPackage('');
  };

  const handleGenerateFinalPackage = () => {
    const pkg = `[제목]
${title}

[도서관 리서치 데이터]
${libraryResponse}

[원문 작성 지시문]
${writerPrompt}`;
    setFinalPackage(pkg);
  };

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-3xl mx-auto space-y-8">
        <header className="text-center mb-12">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center justify-center gap-3">
            <BookOpen className="w-8 h-8 text-blue-600" />
            도서관-원문 브리지
            <PenTool className="w-8 h-8 text-indigo-600" />
          </h1>
          <p className="text-slate-500 mt-3 text-lg">
            리서치부터 원문 작성 지시문까지 하나의 흐름으로 자동화합니다.
          </p>
        </header>

        {/* Step 1 */}
        <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8">
          <h2 className="text-xl font-semibold flex items-center gap-3 mb-6 text-slate-800">
            <span className="bg-blue-100 text-blue-700 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"><Filter className="w-4 h-4" /></span>
            키워드 필터 (작성 여부 판단)
          </h2>
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">주제 또는 제목</label>
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  className="flex-1 border border-slate-300 rounded-xl p-3.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                  placeholder="예: 2024년 미국 금리 인하 전망과 한국 증시 영향"
                />
                <button
                  onClick={handleAnalyzeKeyword}
                  disabled={!title.trim()}
                  className="bg-slate-800 text-white px-6 py-3 rounded-xl font-medium hover:bg-slate-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                >
                  키워드 분석
                </button>
              </div>
            </div>

            {keywordAnalysis && (
              <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <div className="text-slate-500 text-xs font-medium mb-1 flex items-center gap-1"><Activity className="w-3 h-3"/> 트래픽 가능성</div>
                  <div className="font-semibold text-slate-800">{keywordAnalysis.traffic}</div>
                </div>
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <div className="text-slate-500 text-xs font-medium mb-1 flex items-center gap-1"><FileText className="w-3 h-3"/> 의도 강도</div>
                  <div className="font-semibold text-slate-800">{keywordAnalysis.intentStrength}</div>
                </div>
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <div className="text-slate-500 text-xs font-medium mb-1 flex items-center gap-1"><Layers className="w-3 h-3"/> 확장성 (클러스터)</div>
                  <div className="font-semibold text-slate-800">{keywordAnalysis.scalability}</div>
                </div>
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <div className="text-slate-500 text-xs font-medium mb-1 flex items-center gap-1"><Swords className="w-3 h-3"/> 경쟁도</div>
                  <div className="font-semibold text-slate-800">{keywordAnalysis.competition}</div>
                </div>
                <div className={`col-span-2 sm:col-span-4 p-5 rounded-xl border flex items-center justify-between ${
                  keywordAnalysis.decision === 'GO' ? 'bg-green-50 border-green-200' :
                  keywordAnalysis.decision === 'HOLD' ? 'bg-yellow-50 border-yellow-200' :
                  'bg-red-50 border-red-200'
                }`}>
                  <div>
                    <div className={`text-sm font-bold mb-1 ${
                      keywordAnalysis.decision === 'GO' ? 'text-green-800' :
                      keywordAnalysis.decision === 'HOLD' ? 'text-yellow-800' :
                      'text-red-800'
                    }`}>최종 판단</div>
                    <div className="text-2xl font-black tracking-tight" style={{ color: keywordAnalysis.decision === 'GO' ? '#166534' : keywordAnalysis.decision === 'HOLD' ? '#854d0e' : '#991b1b' }}>
                      {keywordAnalysis.decision}
                    </div>
                  </div>
                  <div className="text-right text-sm font-medium opacity-80 max-w-[200px] sm:max-w-none">
                    {keywordAnalysis.decision === 'GO' && '작성 진행 (행동 키워드 또는 전망 예외 충족)'}
                    {keywordAnalysis.decision === 'HOLD' && '조건부 진행 (행동/전망 키워드 누락 또는 조건 부족)'}
                    {keywordAnalysis.decision === 'DROP' && '작성하지 않음 (트래픽, 의도, 확장성 부족)'}
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Step 2 */}
        <section className={`bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8 transition-opacity duration-300 ${(!keywordAnalysis || keywordAnalysis.decision === 'DROP') ? 'opacity-50 pointer-events-none' : ''}`}>
          <h2 className="text-xl font-semibold flex items-center gap-3 mb-6 text-slate-800">
            <span className="bg-blue-100 text-blue-700 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold">1</span>
            도서관 지시문 생성
          </h2>
          <div className="space-y-5">
            <button
              onClick={handleGenerateLibraryPrompt}
              className="w-full sm:w-auto bg-blue-600 text-white px-6 py-3 rounded-xl font-medium hover:bg-blue-700 transition-colors"
            >
              도서관 지시문 생성
            </button>

            {libraryPrompt && (
              <div className="mt-6 bg-slate-50 rounded-xl border border-slate-200 p-5 relative group">
                <pre className="whitespace-pre-wrap text-sm text-slate-700 font-mono leading-relaxed">{libraryPrompt}</pre>
                <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                  <CopyButton text={libraryPrompt} />
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Step 3 */}
        <section className={`bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8 transition-opacity duration-300 ${!libraryPrompt ? 'opacity-50 pointer-events-none' : ''}`}>
          <h2 className="text-xl font-semibold flex items-center gap-3 mb-6 text-slate-800">
            <span className="bg-blue-100 text-blue-700 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold">2</span>
            도서관 응답 평가
          </h2>
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">도서관 응답 (JSON 붙여넣기)</label>
              <textarea
                value={libraryResponse}
                onChange={e => setLibraryResponse(e.target.value)}
                className="w-full border border-slate-300 rounded-xl p-3.5 h-48 font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all resize-y"
                placeholder="도서관 AI가 생성한 JSON 결과를 여기에 붙여넣으세요..."
              />
            </div>
            <button
              onClick={handleEvaluate}
              disabled={!libraryResponse.trim()}
              className="w-full sm:w-auto bg-blue-600 text-white px-6 py-3 rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              평가 실행
            </button>

            {evaluation && (
              <div className={`mt-6 rounded-xl border p-5 flex items-start gap-4 ${
                evaluation.status === '통과' ? 'bg-green-50 border-green-200' :
                evaluation.status === '조건부 통과' ? 'bg-yellow-50 border-yellow-200' :
                'bg-red-50 border-red-200'
              }`}>
                <div className="mt-0.5 shrink-0">
                  {evaluation.status === '통과' && <CheckCircle2 className="text-green-600 w-6 h-6" />}
                  {evaluation.status === '조건부 통과' && <AlertCircle className="text-yellow-600 w-6 h-6" />}
                  {evaluation.status === '보류' && <XCircle className="text-red-600 w-6 h-6" />}
                </div>
                <div>
                  <h3 className={`text-lg font-bold ${
                    evaluation.status === '통과' ? 'text-green-800' :
                    evaluation.status === '조건부 통과' ? 'text-yellow-800' :
                    'text-red-800'
                  }`}>{evaluation.status}</h3>
                  {evaluation.reasons.length > 0 && (
                    <ul className="mt-3 space-y-1.5 text-sm text-slate-700">
                      {evaluation.reasons.map((r, i) => <li key={i} className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-current opacity-50"></span>{r}</li>)}
                    </ul>
                  )}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Step 4 */}
        <section className={`bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8 transition-opacity duration-300 ${(!evaluation || evaluation.status === '보류') ? 'opacity-50 pointer-events-none' : ''}`}>
          <h2 className="text-xl font-semibold flex items-center gap-3 mb-6 text-slate-800">
            <span className="bg-blue-100 text-blue-700 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold">3</span>
            원문 지시문 생성
          </h2>
          <div className="space-y-5">
            <button
              onClick={handleGenerateWriterPrompt}
              className="w-full sm:w-auto bg-blue-600 text-white px-6 py-3 rounded-xl font-medium hover:bg-blue-700 transition-colors"
            >
              원문 지시문 생성
            </button>

            {writerPrompt && (
              <div className="mt-6 bg-slate-50 rounded-xl border border-slate-200 p-5 relative group">
                <pre className="whitespace-pre-wrap text-sm text-slate-700 font-mono leading-relaxed">{writerPrompt}</pre>
                <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                  <CopyButton text={writerPrompt} />
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Step 5 */}
        <section className={`bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8 transition-opacity duration-300 ${!writerPrompt ? 'opacity-50 pointer-events-none' : ''}`}>
          <h2 className="text-xl font-semibold flex items-center gap-3 mb-6 text-slate-800">
            <span className="bg-indigo-100 text-indigo-700 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"><Package className="w-4 h-4" /></span>
            최종 패키지 생성
          </h2>
          <div className="space-y-5">
            <button
              onClick={handleGenerateFinalPackage}
              className="w-full sm:w-auto bg-indigo-600 text-white px-6 py-3 rounded-xl font-medium hover:bg-indigo-700 transition-colors"
            >
              원문젬 전달 패키지 생성
            </button>

            {finalPackage && (
              <div className="mt-6 bg-slate-900 rounded-xl border border-slate-800 p-5 relative group">
                <pre className="whitespace-pre-wrap text-sm text-slate-300 font-mono leading-relaxed">{finalPackage}</pre>
                <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                  <CopyButton text={finalPackage} dark />
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
