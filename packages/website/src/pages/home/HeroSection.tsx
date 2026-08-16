/* eslint-disable react-dom/no-dangerously-set-innerhtml */
import type { PageAgent as PageAgentType } from 'page-agent'
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'wouter'

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

	useEffect(() => {
		setTask(defaultTask)
	}, [defaultTask])

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
						console.log('[instructions] getPageInstructions:', url, '->', hint)
						return hint
					},
				},

				model:
					import.meta.env.DEV && import.meta.env.LLM_MODEL_NAME
						? import.meta.env.LLM_MODEL_NAME
						: DEMO_MODEL,
				baseURL:
					import.meta.env.DEV && import.meta.env.LLM_BASE_URL
						? import.meta.env.LLM_BASE_URL
						: DEMO_BASE_URL,
				apiKey:
					import.meta.env.DEV && import.meta.env.LLM_API_KEY
						? import.meta.env.LLM_API_KEY
						: DEMO_API_KEY,
			})
		}

		const result = await win.pageAgent.execute(task)
		console.log(result)
	}

	return (
		<section
			className="relative px-4 sm:px-6 pt-20 sm:pt-24 py-16 sm:py-20 pb-16 lg:py-24 lg:pt-28 overflow-hidden bg-[#050508]"
			aria-labelledby="hero-heading"
		>
			{/* Street-art neon washes */}
			<div className="absolute inset-0 pointer-events-none" aria-hidden="true">
				<div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[120%] h-[70%] bg-[radial-gradient(ellipse_at_center,rgba(168,85,247,0.28)_0%,transparent_60%)]" />
				<div className="absolute top-1/3 -left-20 w-[55%] h-[50%] bg-[radial-gradient(ellipse_at_center,rgba(20,184,166,0.18)_0%,transparent_65%)]" />
				<div className="absolute bottom-0 right-0 w-[50%] h-[45%] bg-[radial-gradient(ellipse_at_center,rgba(168,85,247,0.15)_0%,transparent_60%)]" />
				<div
					className="absolute inset-0 opacity-[0.04]"
					style={{
						backgroundImage:
							'linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)',
						backgroundSize: '48px 48px',
					}}
				/>
			</div>

			<div className="max-w-7xl mx-auto text-center relative z-10">
				<Particles
					className="absolute inset-0"
					quantity={100}
					staticity={28}
					ease={70}
					color="#a855f7"
				/>

				<div className="relative z-10">
					{/* Graffiti-style badge */}
					<div className="inline-flex items-center gap-2 px-5 py-2.5 mb-8 sm:mb-10 text-sm sm:text-base font-bold tracking-wide rounded-full border border-purple-400/40 bg-black/60 shadow-[0_0_24px_rgba(168,85,247,0.35)] backdrop-blur-md">
						<span
							className="w-2.5 h-2.5 bg-teal-400 rounded-full animate-pulse shadow-[0_0_10px_#2dd4bf]"
							aria-hidden="true"
						/>
						<AnimatedGradientText colorFrom="#2dd4bf" colorTo="#c084fc">
							MAKE AI FREE
						</AnimatedGradientText>
					</div>

					{/* Headline */}
					<h1
						id="hero-heading"
						className="text-4xl sm:text-5xl lg:text-7xl font-black mb-8 sm:mb-12 mt-4 sm:mt-6 leading-[1.1] tracking-tight"
						style={{
							textShadow:
								'0 0 40px rgba(168,85,247,0.45), 0 0 80px rgba(20,184,166,0.2)',
						}}
					>
						{isZh ? (
							<>
								<span className="block text-5xl sm:text-6xl lg:text-7xl bg-linear-to-r from-teal-300 via-purple-300 to-fuchsia-400 bg-clip-text text-transparent">
									你网站里的 AI 操作员
								</span>
								<span className="block text-lg sm:text-xl lg:text-2xl mt-4 font-semibold bg-linear-to-r from-teal-400 to-purple-400 bg-clip-text text-transparent">
									The AI Operator Living in Your Web Page
								</span>
							</>
						) : (
							<>
								<span className="bg-linear-to-r from-teal-300 via-purple-300 to-fuchsia-400 bg-clip-text text-transparent">
									The AI Operator
								</span>
								<br />
								<span className="bg-linear-to-r from-fuchsia-400 via-purple-300 to-teal-300 bg-clip-text text-transparent">
									Living in Your Web Page
								</span>
							</>
						)}
					</h1>

					<p className="text-base sm:text-xl lg:text-2xl text-gray-300 mb-10 sm:mb-12 max-w-3xl mx-auto leading-relaxed px-1">
						<Highlighter action="underline" color="#c084fc" strokeWidth={2}>
							<span className="bg-linear-to-r from-teal-400 to-purple-400 bg-clip-text text-transparent font-bold">
								{isZh ? '🪄一行代码' : '🪄One line of code'}
							</span>
						</Highlighter>
						{isZh
							? '，让你的网站变身 AI 原生应用。'
							: ', turns your website into an AI-native app.'}
						<br className="hidden sm:block" />
						{isZh
							? '用户/答疑机器人给出文字指示，AI 帮你操作页面。'
							: ' Users give natural language commands, AI handles the rest. '}
						<span className="text-teal-300 font-semibold">No gatekeepers.</span>
					</p>

					{/* Try It Now Section - Tab Card */}
					<div className="mb-10 sm:mb-12 px-0 sm:px-2">
						<div className="max-w-3xl mx-auto">
							<NeonGradientCard
								borderSize={2}
								borderRadius={20}
								neonColors={{ firstColor: '#14b8a6', secondColor: '#a855f7' }}
							>
								{/* Tab Headers */}
								<div className="flex border-b border-white/10 bg-black/40 rounded-t-[18px]">
									<button
										onClick={() => setActiveTab('try')}
										className={`cursor-pointer flex-1 px-3 sm:px-4 py-3.5 sm:py-4 text-base sm:text-lg font-medium transition-colors duration-200 rounded-tl-2xl ${
											activeTab === 'try'
												? 'bg-linear-to-r from-teal-500/20 to-purple-500/20 text-teal-300 border-b-2 border-teal-400'
												: 'text-gray-400 hover:text-white hover:bg-white/5'
										}`}
									>
										{isZh ? '🚀 立即尝试' : '🚀 Try It Now'}
									</button>
									<button
										onClick={() => setActiveTab('other')}
										className={`cursor-pointer flex-1 px-3 sm:px-4 py-3.5 sm:py-4 text-base sm:text-lg font-medium transition-colors duration-200 rounded-tr-2xl ${
											activeTab === 'other'
												? 'bg-linear-to-r from-green-500/20 to-teal-500/20 text-green-300 border-b-2 border-green-400'
												: 'text-gray-400 hover:text-white hover:bg-white/5'
										}`}
									>
										{isZh ? '🌐 其他网页尝试' : '🌐 Try on Other Sites'}
									</button>
								</div>

								{/* Tab Content */}
								<div className="p-3 sm:p-4 bg-black/50 rounded-b-[18px]">
									{activeTab === 'try' && (
										<div className="space-y-4">
											<div className="relative">
												<input
													value={task}
													onChange={(e) => setTask(e.target.value)}
													placeholder={
														isZh
															? '输入您想要 AI 执行的任务...'
															: 'Describe what you want AI to do...'
													}
													className="w-full px-4 py-3 pr-20 border border-white/15 rounded-lg bg-black/60 text-white placeholder-gray-500 focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-none text-sm mb-0"
													data-page-agent-not-interactive
												/>
												<button
													onClick={handleExecute}
													disabled={!ready}
													className="absolute right-2 top-2 px-5 py-1.5 bg-linear-to-r from-teal-500 to-purple-600 text-white font-medium rounded-md hover:shadow-[0_0_20px_rgba(168,85,247,0.5)] transform hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none text-sm"
													data-page-agent-not-interactive
												>
													{ready ? (
														isZh ? (
															'执行'
														) : (
															'Run'
														)
													) : (
														<span className="animate-pulse">
															{isZh ? '准备中...' : 'Preparing...'}
														</span>
													)}
												</button>
											</div>
											<p className="text-xs text-gray-500 text-left">
												{isZh ? (
													<>
														使用免费测试 LLM API，点击执行即表示您同意
														<a
															href="https://github.com/alibaba/page-agent/blob/main/docs/terms-and-privacy.md#2-testing-api-and-demo-disclaimer--terms-of-use"
															target="_blank"
															rel="noopener noreferrer"
															className="underline text-teal-400"
														>
															使用条款
														</a>
													</>
												) : (
													<>
														Powered by free testing LLM API. By clicking Run you agree to the{' '}
														<a
															href="https://github.com/alibaba/page-agent/blob/main/docs/terms-and-privacy.md#2-testing-api-and-demo-disclaimer--terms-of-use"
															target="_blank"
															rel="noopener noreferrer"
															className="underline text-teal-400"
														>
															Terms of Use
														</a>
													</>
												)}
											</p>
										</div>
									)}

									{activeTab === 'other' && (
										<div className="space-y-4">
											{/* Mobile hard limits — always visible */}
											<div className="bg-red-500/15 border border-red-400/30 p-3 sm:p-4 rounded-lg text-left">
												<p className="text-red-200 text-sm font-semibold mb-2">
													{isZh ? '📱 手机限制（请先读）' : '📱 Mobile limits (read first)'}
												</p>
												<ul className="space-y-1.5 text-sm text-gray-300">
													<li className="flex items-start">
														<span className="text-red-400 mr-2 shrink-0">•</span>
														<span>
															<strong className="text-red-200">iPhone Safari / Chrome / Firefox:</strong>{' '}
															{isZh
																? 'Apple 禁止 javascript: 书签，无法安装书签小工具。请用本页「立即尝试」，或改用桌面浏览器。'
																: 'Apple blocks javascript: bookmarks. Bookmarklets cannot run. Use “Try It Now” on this page, or switch to desktop.'}
														</span>
													</li>
													<li className="flex items-start">
														<span className="text-red-400 mr-2 shrink-0">•</span>
														<span>
															<strong className="text-red-200">{isZh ? '地址栏不可见：' : 'Address bar is invisible:'}</strong>{' '}
															{isZh
																? 'PageAgent 只能操作网页内容，看不到浏览器地址栏。请先自己打开目标网站，再点书签。'
																: 'PageAgent only sees page content — not the browser URL bar. Open the target site yourself first, then tap the bookmark.'}
														</span>
													</li>
												</ul>
											</div>

											<div className="grid md:grid-cols-2 gap-4 sm:gap-6">
												{/* Desktop steps */}
												<div className="space-y-3 sm:space-y-4">
													<div className="bg-teal-500/10 border border-teal-500/20 p-3 sm:p-4 rounded-lg">
														<p className="text-gray-300 text-sm mb-3">
															<span className="font-semibold text-teal-300">{isZh ? '步骤 1 (桌面):' : 'Step 1 (Desktop):'}</span>{' '}
															{isZh ? '显示收藏夹栏' : 'Show your bookmarks bar'}
														</p>
														<div className="flex items-center justify-center gap-2 flex-wrap">
															<kbd className="px-2 py-1 bg-black/50 border border-white/20 rounded text-xs font-mono text-gray-200">
																Ctrl + Shift + B
															</kbd>
															<span className="text-gray-500">{isZh ? '或' : 'or'}</span>
															<kbd className="px-2 py-1 bg-black/50 border border-white/20 rounded text-xs font-mono text-gray-200">
																⌘ + Shift + B
															</kbd>
														</div>
													</div>

													<div className="bg-green-500/10 border border-green-500/20 p-3 sm:p-4 rounded-lg">
														<p className="text-gray-300 text-sm mb-3">
															<span className="font-semibold text-green-300">{isZh ? '步骤 2:' : 'Step 2:'}</span>{' '}
															{isZh ? '拖拽下面按钮到收藏夹栏' : 'Drag this button to your bookmarks'}
														</p>
														<div className="flex items-center justify-center gap-3 flex-wrap">
															<select
																value={cdnSource}
																onChange={(e) =>
																	setCdnSource(e.target.value as 'international' | 'china')
																}
																className="px-2 py-1.5 text-xs border border-white/20 rounded bg-black/50 text-gray-200"
															>
																<option value="international">jsdelivr CDN</option>
																<option value="china">npmmirror CDN</option>
															</select>
															<div
																dangerouslySetInnerHTML={{
																	__html: getInjection(cdnSource === 'china'),
																}}
															></div>
														</div>
													</div>

													<div className="bg-purple-500/10 border border-purple-500/20 p-3 sm:p-4 rounded-lg">
														<p className="text-gray-300 text-sm">
															<span className="font-semibold text-purple-300">{isZh ? '步骤 3:' : 'Step 3:'}</span>{' '}
															{isZh
																? '先打开目标网站，再点收藏夹里的 PageAgent'
																: 'Open the target site first, then click the PageAgent bookmark'}
														</p>
													</div>
												</div>

												{/* Heads Up */}
												<div className="bg-yellow-500/10 border border-yellow-500/20 p-3 sm:p-4 rounded-lg">
													<h4 className="font-semibold text-yellow-200 mb-3 text-sm">
														{isZh ? '⚠️ 注意' : '⚠️ Heads Up'}
													</h4>
													<ul className="space-y-2 text-sm text-gray-300">
														<li className="flex items-start text-left">
															<span className="w-1.5 h-1.5 bg-yellow-400 rounded-full mt-2 mr-2 shrink-0 "></span>
															{isZh ? (
																<span>
																	使用免费测试 LLM API，使用即表示同意
																	<a
																		href="https://github.com/alibaba/page-agent/blob/main/docs/terms-and-privacy.md#2-testing-api-and-demo-disclaimer--terms-of-use"
																		target="_blank"
																		rel="noopener noreferrer"
																		className="text-yellow-300 underline"
																	>
																		使用条款
																	</a>
																</span>
															) : (
																<span>
																	Uses free testing LLM API. By using you agree to the{' '}
																	<a
																		href="https://github.com/alibaba/page-agent/blob/main/docs/terms-and-privacy.md#2-testing-api-and-demo-disclaimer--terms-of-use"
																		target="_blank"
																		rel="noopener noreferrer"
																		className="text-yellow-300 underline"
																	>
																		Terms of Use
																	</a>
																</span>
															)}
														</li>
														<li className="flex items-start text-left">
															<span className="w-1.5 h-1.5 bg-yellow-400 rounded-full mt-2 mr-2 shrink-0 "></span>
															{isZh
																? '数据通过中国大陆服务器处理'
																: 'Data processed via servers in Mainland China'}
														</li>
														<li className="flex items-start text-left">
															<span className="w-1.5 h-1.5 bg-yellow-400 rounded-full mt-2 mr-2 shrink-0 "></span>
															{isZh
																? '部分网站屏蔽了脚本注入 (CSP)，将无反应'
																: 'Some sites block script injection (CSP policies)'}
														</li>
														<li className="flex items-start text-left">
															<span className="w-1.5 h-1.5 bg-yellow-400 rounded-full mt-2 mr-2 shrink-0 "></span>
															{isZh ? '支持单页应用' : 'Works on single-page apps'}
														</li>
														<li className="flex items-start text-left">
															<span className="w-1.5 h-1.5 bg-yellow-400 rounded-full mt-2 mr-2 shrink-0 "></span>
															{isZh
																? '仅识别文本，不识别图像，不支持拖拽等复杂交互'
																: 'Text-only understanding—no image recognition or drag-and-drop'}
														</li>
														<li className="flex items-start text-left">
															<span className="w-1.5 h-1.5 bg-yellow-400 rounded-full mt-2 mr-2 shrink-0 "></span>
															{isZh ? '详细使用限制参照' : 'Full limitations in'}
															<Link
																href="/docs/introduction/limitations"
																className="text-teal-400 hover:underline pl-1"
															>
																{isZh ? '《文档》' : 'Docs'}
															</Link>
														</li>
													</ul>
												</div>
											</div>
										</div>
									)}
								</div>
							</NeonGradientCard>
						</div>
					</div>

					<ul
						className="flex flex-wrap justify-center gap-4 sm:gap-6 text-xs sm:text-sm text-gray-400"
						role="list"
					>
						<li className="flex items-center">
							<span className="w-2 h-2 bg-teal-400 rounded-full mr-2 shadow-[0_0_8px_#2dd4bf]" aria-hidden="true"></span>
							{isZh ? '纯前端方案' : 'Pure Front-end Solution'}
						</li>
						<li className="flex items-center">
							<span className="w-2 h-2 bg-purple-400 rounded-full mr-2 shadow-[0_0_8px_#c084fc]" aria-hidden="true"></span>
							{isZh ? '支持私有模型' : 'Your Own Models'}
						</li>
						<li className="flex items-center">
							<span className="w-2 h-2 bg-fuchsia-400 rounded-full mr-2 shadow-[0_0_8px_#e879f9]" aria-hidden="true"></span>
							{isZh ? '无痛脱敏' : 'Built-in Privacy'}
						</li>
						<li className="flex items-center">
							<span className="w-2 h-2 bg-green-400 rounded-full mr-2 shadow-[0_0_8px_#4ade80]" aria-hidden="true"></span>
							{isZh ? 'MIT 开源' : 'MIT Open Source'}
						</li>
					</ul>
				</div>
			</div>
		</section>
	)
}
