/* eslint-disable react-dom/no-dangerously-set-innerhtml */
import type { PageAgent as PageAgentType } from 'page-agent'
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'wouter'

import { FRENCHIE_MASCOT, HUSKY_MASCOT } from '../../assets/mascots'
import { AnimatedGradientText } from '../../components/ui/animated-gradient-text'
import { Highlighter } from '../../components/ui/highlighter'
import { NeonGradientCard } from '../../components/ui/neon-gradient-card'
import { Particles } from '../../components/ui/particles'
import {
	CDN_DEMO_CN_URL,
	CDN_DEMO_URL,
	DEMO_API_KEY,
	DEMO_BASE_URL,
	DEMO_MODEL,
} from '../../constants'
import { useLanguage } from '../../i18n/context'

let pageAgentModule: Promise<typeof import('page-agent')> | null = null

function getInjection(useCN?: boolean) {
	const cdn = useCN ? CDN_DEMO_CN_URL : CDN_DEMO_URL
	const injection = encodeURI(
		`javascript:(function(){var s=document.createElement('script');s.src=\`${cdn}?t=\${Math.random()}\`;s.setAttribute('crossorigin', true);s.type="text/javascript";s.onload=()=>console.log('PageAgent script loaded!');document.body.appendChild(s);})();`
	)
	return `
	<a
		href=${injection}
		class="inline-flex items-center text-xs px-3 py-2 bg-teal-500 text-white font-medium rounded-lg hover:shadow-md transform hover:scale-105 transition-all duration-200 cursor-move border-2 border-dashed border-teal-300"
		draggable="true"
		onclick="return false;"
		title="Drag me to your bookmarks bar!"
	>
		✨PageAgent
	</a>
	`
}

export default function HeroSection() {
	const { language, isZh } = useLanguage()

	const defaultTask = isZh
		? '从导航栏中进入文档页，打开"快速开始"相关的文档，帮我总结成 markdown'
		: 'Goto docs in navigation bar, find Quick-Start section, and summarize in markdown'

	const [task, setTask] = useState(() => defaultTask)
	useEffect(() => { setTask(defaultTask) }, [defaultTask])

	const [params] = useSearchParams()
	const isOther = params.has('try_other')
	const [activeTab, setActiveTab] = useState<'try' | 'other'>(isOther ? 'other' : 'try')
	const [cdnSource, setCdnSource] = useState<'international' | 'china'>('international')
	const [ready, setReady] = useState(false)
	useEffect(() => {
		pageAgentModule ??= import('page-agent')
		pageAgentModule.then(() => setReady(true))
	}, [])

	const handleExecute = async () => {
		if (!task.trim() || !ready || !pageAgentModule) return
		const { PageAgent } = await pageAgentModule
		const win = window as any
		if (!win.pageAgent || win.pageAgent.disposed) {
			win.pageAgent = new (PageAgent as typeof PageAgentType)({
				interactiveBlacklist: [document.getElementById('root')!],
				language: language,
				instructions: {
					system: 'You are a helpful assistant on PageAgent website.',
					getPageInstructions: (url: string) => {
						const hint = url.includes('page-agent') ? 'This is PageAgent demo page.' : undefined
						return hint
					},
				},
				model: import.meta.env.DEV && import.meta.env.LLM_MODEL_NAME ? import.meta.env.LLM_MODEL_NAME : DEMO_MODEL,
				baseURL: import.meta.env.DEV && import.meta.env.LLM_BASE_URL ? import.meta.env.LLM_BASE_URL : DEMO_BASE_URL,
				apiKey: import.meta.env.DEV && import.meta.env.LLM_API_KEY ? import.meta.env.LLM_API_KEY : DEMO_API_KEY,
			})
		}
		const result = await win.pageAgent.execute(task)
		console.log(result)
	}

	return (
		<section
			className="relative px-4 sm:px-6 pt-20 sm:pt-24 py-12 sm:py-16 pb-12 lg:py-20 lg:pt-28 overflow-hidden bg-[#050508]"
			aria-labelledby="hero-heading"
		>
			{/* Brick / street atmosphere */}
			<div className="absolute inset-0 pointer-events-none" aria-hidden="true">
				<div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_40%,rgba(168,85,247,0.22)_0%,transparent_55%)]" />
				<div className="absolute inset-0 bg-[radial-gradient(ellipse_at_80%_60%,rgba(20,184,166,0.14)_0%,transparent_50%)]" />
				<div
					className="absolute inset-0 opacity-[0.06]"
					style={{
						backgroundImage:
							'linear-gradient(rgba(255,255,255,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.07) 1px, transparent 1px)',
						backgroundSize: '40px 40px',
					}}
				/>
			</div>

			<div className="max-w-6xl mx-auto relative z-10">
				<Particles className="absolute inset-0" quantity={60} staticity={30} ease={70} color="#a855f7" />

				{/* === EQw6Y-style split: Frenchie left | graffiti + copy right === */}
				<div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-10 items-center mb-10 sm:mb-14">
					{/* Large Frenchie — primary brand art */}
					<div className="flex justify-center md:justify-end order-1">
						<img
							src={FRENCHIE_MASCOT}
							alt="Cyber Frenchie — Make AI Free"
							className="w-48 sm:w-64 md:w-72 lg:w-80 h-auto drop-shadow-[0_0_40px_rgba(168,85,247,0.6)] select-none pointer-events-none"
							draggable={false}
						/>
					</div>

					{/* Graffiti MAKE AI FREE + pitch */}
					<div className="text-center md:text-left order-2 space-y-4 sm:space-y-5">
						<div className="inline-flex items-center gap-2 px-3 py-1.5 text-[10px] sm:text-xs font-bold tracking-[0.2em] uppercase rounded-full border border-teal-400/30 bg-black/50 text-teal-300">
							★ {isZh ? 'AI 应该开放，人人平等' : 'AI SHOULD BE OPEN. ACCESS SHOULD BE EQUAL.'}
						</div>

						{/* Giant graffiti treatment */}
						<h1
							id="hero-heading"
							className="font-black leading-[0.9] tracking-tight"
							style={{ textShadow: '0 0 50px rgba(45,212,191,0.35), 0 0 80px rgba(168,85,247,0.25)' }}
						>
							<span className="block text-5xl sm:text-6xl lg:text-7xl xl:text-8xl bg-linear-to-br from-teal-300 via-cyan-300 to-teal-400 bg-clip-text text-transparent">
								MAKE
							</span>
							<span className="block text-5xl sm:text-6xl lg:text-7xl xl:text-8xl bg-linear-to-br from-purple-300 via-fuchsia-400 to-purple-500 bg-clip-text text-transparent">
								AI FREE
							</span>
						</h1>

						<p className="text-sm sm:text-base lg:text-lg text-gray-300 max-w-md mx-auto md:mx-0 leading-relaxed">
							{isZh
								? '一行代码，让你的网站变身 AI 原生应用。无门卫。'
								: 'Powerful AI on any page. No gatekeepers. No hidden costs. Just freedom to build.'}
						</p>

						<p className="text-base sm:text-lg text-gray-400 max-w-md mx-auto md:mx-0">
							<Highlighter action="underline" color="#c084fc" strokeWidth={2}>
								<span className="bg-linear-to-r from-teal-400 to-purple-400 bg-clip-text text-transparent font-bold">
									{isZh ? '🪄一行代码' : '🪄One line of code'}
								</span>
							</Highlighter>
							{isZh ? '，AI 操作你的网页。' : ' turns any site into an AI-native app.'}
						</p>

						{/* Husky accent small */}
						<div className="hidden md:flex items-center gap-3 pt-2">
							<img src={HUSKY_MASCOT} alt="" className="w-14 h-auto opacity-90" draggable={false} />
							<span className="text-xs text-gray-500 uppercase tracking-wider">{isZh ? '无付费墙 · 无限制' : 'No paywalls. No limits.'}</span>
						</div>
					</div>
				</div>

				{/* === Agent demo panel — kept fully functional === */}
				<div className="relative z-10 mb-10 sm:mb-12">
					<div className="max-w-3xl mx-auto">
						<NeonGradientCard
							borderSize={2}
							borderRadius={20}
							neonColors={{ firstColor: '#14b8a6', secondColor: '#a855f7' }}
						>
							<div className="flex border-b border-white/10 bg-black/40 rounded-t-[18px]">
								<button
									onClick={() => setActiveTab('try')}
									className={`cursor-pointer flex-1 px-3 sm:px-4 py-3.5 text-base sm:text-lg font-medium transition-colors rounded-tl-2xl ${
										activeTab === 'try'
											? 'bg-linear-to-r from-teal-500/20 to-purple-500/20 text-teal-300 border-b-2 border-teal-400'
											: 'text-gray-400 hover:text-white hover:bg-white/5'
									}`}
								>
									{isZh ? '🚀 立即尝试' : '🚀 Try It Now'}
								</button>
								<button
									onClick={() => setActiveTab('other')}
									className={`cursor-pointer flex-1 px-3 sm:px-4 py-3.5 text-base sm:text-lg font-medium transition-colors rounded-tr-2xl ${
										activeTab === 'other'
											? 'bg-linear-to-r from-green-500/20 to-teal-500/20 text-green-300 border-b-2 border-green-400'
											: 'text-gray-400 hover:text-white hover:bg-white/5'
									}`}
								>
									{isZh ? '🌐 其他网页尝试' : '🌐 Try on Other Sites'}
								</button>
							</div>

							<div className="p-3 sm:p-4 bg-black/50 rounded-b-[18px]">
								{activeTab === 'try' && (
									<div className="space-y-4">
										<div className="relative">
											<input
												value={task}
												onChange={(e) => setTask(e.target.value)}
												placeholder={isZh ? '输入您想要 AI 执行的任务...' : 'Describe what you want AI to do...'}
												className="w-full px-4 py-3 pr-20 border border-white/15 rounded-lg bg-black/60 text-white placeholder-gray-500 focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
												data-page-agent-not-interactive
											/>
											<button
												onClick={handleExecute}
												disabled={!ready}
												className="absolute right-2 top-2 px-5 py-1.5 bg-linear-to-r from-teal-500 to-purple-600 text-white font-medium rounded-md hover:shadow-[0_0_20px_rgba(168,85,247,0.5)] transition-all disabled:opacity-50 text-sm"
												data-page-agent-not-interactive
											>
												{ready ? (isZh ? '执行' : 'Run') : <span className="animate-pulse">{isZh ? '准备中...' : 'Preparing...'}</span>}
											</button>
										</div>
										<p className="text-xs text-gray-500 text-left">
											{isZh ? (
												<>使用免费测试 LLM API，点击执行即表示您同意 <a href="https://github.com/alibaba/page-agent/blob/main/docs/terms-and-privacy.md#2-testing-api-and-demo-disclaimer--terms-of-use" target="_blank" rel="noopener noreferrer" className="underline text-teal-400">使用条款</a></>
											) : (
												<>Powered by free testing LLM API. By clicking Run you agree to the <a href="https://github.com/alibaba/page-agent/blob/main/docs/terms-and-privacy.md#2-testing-api-and-demo-disclaimer--terms-of-use" target="_blank" rel="noopener noreferrer" className="underline text-teal-400">Terms of Use</a></>
											)}
										</p>
									</div>
								)}

								{activeTab === 'other' && (
									<div className="space-y-4">
										<div className="bg-red-500/15 border border-red-400/30 p-3 rounded-lg text-left">
											<p className="text-red-200 text-sm font-semibold mb-2">{isZh ? '📱 手机限制' : '📱 Mobile limits'}</p>
											<ul className="space-y-1.5 text-sm text-gray-300">
												<li>• <strong className="text-red-200">iPhone:</strong> {isZh ? 'Apple 禁止 javascript: 书签。用本页「立即尝试」或桌面。' : 'Apple blocks javascript: bookmarks. Use Try It Now or desktop.'}</li>
												<li>• <strong className="text-red-200">{isZh ? '地址栏：' : 'Address bar:'}</strong> {isZh ? '先打开目标站，再点书签。' : 'Open the target site first, then tap the bookmark.'}</li>
											</ul>
										</div>
										<div className="grid md:grid-cols-2 gap-4">
											<div className="space-y-3">
												<div className="bg-teal-500/10 border border-teal-500/20 p-3 rounded-lg">
													<p className="text-gray-300 text-sm mb-2"><span className="font-semibold text-teal-300">{isZh ? '步骤 1:' : 'Step 1:'}</span> {isZh ? '显示收藏夹栏' : 'Show bookmarks bar'}</p>
													<div className="flex gap-2 justify-center flex-wrap">
														<kbd className="px-2 py-1 bg-black/50 border border-white/20 rounded text-xs font-mono text-gray-200">Ctrl+Shift+B</kbd>
														<kbd className="px-2 py-1 bg-black/50 border border-white/20 rounded text-xs font-mono text-gray-200">⌘+Shift+B</kbd>
													</div>
												</div>
												<div className="bg-green-500/10 border border-green-500/20 p-3 rounded-lg">
													<p className="text-gray-300 text-sm mb-2"><span className="font-semibold text-green-300">{isZh ? '步骤 2:' : 'Step 2:'}</span> {isZh ? '拖到收藏夹' : 'Drag to bookmarks'}</p>
													<div className="flex items-center justify-center gap-2 flex-wrap">
														<select value={cdnSource} onChange={(e) => setCdnSource(e.target.value as 'international' | 'china')} className="px-2 py-1.5 text-xs border border-white/20 rounded bg-black/50 text-gray-200">
															<option value="international">jsdelivr</option>
															<option value="china">npmmirror</option>
														</select>
														<div dangerouslySetInnerHTML={{ __html: getInjection(cdnSource === 'china') }} />
													</div>
												</div>
												<div className="bg-purple-500/10 border border-purple-500/20 p-3 rounded-lg">
													<p className="text-gray-300 text-sm"><span className="font-semibold text-purple-300">{isZh ? '步骤 3:' : 'Step 3:'}</span> {isZh ? '先打开目标站，再点书签' : 'Open target site, then click bookmark'}</p>
												</div>
											</div>
											<div className="bg-yellow-500/10 border border-yellow-500/20 p-3 rounded-lg">
												<h4 className="font-semibold text-yellow-200 mb-2 text-sm">{isZh ? '⚠️ 注意' : '⚠️ Heads Up'}</h4>
												<ul className="space-y-1.5 text-sm text-gray-300">
													<li>• {isZh ? '免费测试 API' : 'Free testing API'}</li>
													<li>• {isZh ? '部分站 CSP 屏蔽' : 'Some sites block CSP'}</li>
													<li>• {isZh ? '仅文本' : 'Text-only'}</li>
													<li>• <Link href="/docs/introduction/limitations" className="text-teal-400 hover:underline">{isZh ? '文档' : 'Docs'}</Link></li>
												</ul>
											</div>
										</div>
									</div>
								)}
							</div>
						</NeonGradientCard>
					</div>
				</div>

				{/* Feature strip — WUG1c energy */}
				<ul className="relative z-10 flex flex-wrap justify-center gap-4 sm:gap-8 text-xs sm:text-sm text-gray-400" role="list">
					<li className="flex items-center gap-2"><span className="w-2 h-2 bg-teal-400 rounded-full shadow-[0_0_8px_#2dd4bf]" />{isZh ? '纯前端' : 'Pure Front-end'}</li>
					<li className="flex items-center gap-2"><span className="w-2 h-2 bg-purple-400 rounded-full shadow-[0_0_8px_#c084fc]" />{isZh ? '自有模型' : 'Your Models'}</li>
					<li className="flex items-center gap-2"><span className="w-2 h-2 bg-fuchsia-400 rounded-full shadow-[0_0_8px_#e879f9]" />{isZh ? '隐私内置' : 'Built-in Privacy'}</li>
					<li className="flex items-center gap-2"><span className="w-2 h-2 bg-green-400 rounded-full shadow-[0_0_8px_#4ade80]" />MIT Open Source</li>
				</ul>
			</div>
		</section>
	)
}
