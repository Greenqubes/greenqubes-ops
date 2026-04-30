import React, { useState, useEffect, useRef } from 'react';
import {
  Calendar, MessageSquare, Send, Plus, ChevronRight, ChevronLeft, ChevronDown,
  Sparkles, Check, X, AlertCircle, Paperclip, Search, Globe,
  ArrowLeft, Loader2, Clock, MapPin, User, Users, Filter, Languages, Bell, BellRing,
  Link2, Phone, Copy, ExternalLink, FileText, Trash2,
  Camera, Image as ImageIcon, Archive, RotateCcw, List, Grid3x3, CalendarDays,
  CheckCircle2, FileSignature, ClipboardList, Lightbulb,
  ShieldCheck, Inbox, Hourglass, UserCog,
  Mic, Square, Play, Pause, HardHat, Briefcase, Radio, MessageCircle, History
} from 'lucide-react';

// ============ I18N ============
const LANGS = [
  { code: 'en', label: 'English', native: 'English' },
  { code: 'zh', label: 'Chinese (Simplified)', native: '简体中文' },
  { code: 'bn', label: 'Bengali', native: 'বাংলা' },
];

const T = {
  en: {
    appPhase: 'PHASE 0',
    schedule: 'Schedule', assistant: 'Assistant',
    companySchedule: 'Company schedule',
    new: 'New', noJobs: 'No jobs scheduled',
    strictOnTime: 'Strict on-time', flexibleWindow: 'Flexible window',
    productionTick: 'Production ✓', doTick: 'DO ✓', file: 'file',
    backToSchedule: 'Schedule', editJob: 'Edit job', newJob: 'New job',
    clashesDetected: 'clash(es) detected',
    date: 'Date', day: 'Day', client: 'Client', clientPick: 'Pick client…',
    addNew: '+ Add new…', otherBlank: 'Others (blank)',
    jobDescription: 'Job description',
    jobDescPlaceholder: "What's being installed / built…",
    locationAddress: 'Location / address',
    locationPlaceholder: 'e.g. Marina Bay Sands, Hall B1',
    timeStart: 'Time start', timeEnd: 'Time end (optional)',
    pickTime: 'Pick time…',
    punctuality: 'Punctuality',
    productionReady: 'Production ready', doIssued: 'DO issued',
    salesPOC: 'Sales / POC', pickSales: 'Pick…',
    installers: 'Installers', suggest: 'Suggest', hide: 'Hide',
    suggestedBased: 'Suggested based on job description',
    added: '✓ Added', addBtn: '+ Add',
    attachment: 'Attachment',
    uploadBrief: 'Upload brief / PTW / drawings',
    delete: 'Delete', cancel: 'Cancel', save: 'Save',
    askPlaceholder: 'Ask, search, or describe a job…',
    assistantSubtitle: 'with web search',
    expand: 'Expand',
    proposedEntry: 'Proposed entry',
    discard: 'Discard', confirmAdd: 'Confirm & add',
    thinking: 'Thinking…',
    settings: 'Settings', language: 'Language', languageHint: 'Saved on this device',
    aiSuggested: 'AI suggested', tapToUse: 'Tap to use',
    readingFile: 'Reading attachment…',
    addNewClientPrompt: 'New client name',
    addNewSalesPrompt: 'New sales / POC name',
    confirmDiscarded: 'OK, discarded.',
    notifications: 'Notifications',
    willNotify: 'Will notify on save',
    notEnrolled: 'not enrolled',
    notifySaveBtn: 'Save & notify',
    saveOnly: 'Save without notifying',
    notifyingNow: 'Sending Telegram messages…',
    notifiedSuccess: 'Notified',
    notifiedSomeFailed: 'enrolment missing',
    onlyChangedNotify: 'Re-notifies on time, installer, location, or attachment changes',
    viaTelegram: 'via Telegram',
    clientPOC: 'Client POC contact',
    clientPOCPlaceholder: 'Phone number (optional)',
    files: 'Files',
    links: 'Links / Downloads',
    addLink: '+ Add link',
    pasteUrl: 'Paste URL (Dropbox, WeTransfer, Drive…)',
    linkLabel: 'Label (optional)',
    linkLabelPlaceholder: 'e.g. Client artwork files',
    sectionPTW: 'Permit-to-Work',
    sectionBCA: 'BCA',
    sectionOthers: 'Others',
    invalidUrl: 'That doesn\'t look like a valid URL',
    copied: 'Copied',
    open: 'Open',
    copy: 'Copy',
    contactPerson: 'Contact person',
    searchOrAddPerson: 'Search or add person…',
    addPersonAs: 'Add as new contact',
    productionPhotos: 'Production photos',
    addPhoto: '+ Add photo',
    photoCount: 'photos',
    productionInstructions: 'Production instructions',
    productionInstructionsPlaceholder: 'Notes for production team (optional)…',
    doShort: 'DO?',
    doProof: 'Signed DO / proof',
    uploadDOPhoto: 'Take photo or upload signed DO',
    completeJob: 'Mark job complete',
    confirmComplete: 'Mark this job as completed?',
    completed: 'Completed',
    completedTab: 'Completed',
    restoreJob: 'Restore to schedule',
    confirmRestore: 'Restore this job to the active schedule?',
    noCompleted: 'No completed jobs yet',
    searchJobs: 'Search jobs, clients, locations…',
    filterAll: 'All',
    filterToday: 'Today',
    filterWeek: 'This week',
    filterUpcoming: 'Upcoming',
    view: 'View',
    viewList: 'List',
    viewWeek: 'Week',
    viewMonth: 'Month',
    closeGallery: 'Close',
    photoOf: 'of',
    designation: 'Designation / role',
    designationPlaceholder: 'e.g. Marketing Manager',
    aiSuggest: 'Suggest',
    aiImprove: 'Improve',
    aiImproving: 'Polishing your text…',
    aiSuggesting: 'Reading attachments…',
    aiOriginal: 'Your original',
    aiSuggested2: 'Suggested',
    aiAccept: 'Use this',
    aiKeep: 'Keep mine',
    linkAdded: 'Added',
    linkExpires: 'Expires',
    setExpiry: 'Set expiry',
    noExpiry: 'No expiry set',
    expiryToday: 'Expires today',
    expiryTomorrow: 'Expires tomorrow',
    expiresInDays: 'Expires in',
    days: 'days',
    expired: 'Expired',
    presetExpiryWT: 'WeTransfer (3d)',
    presetExpiry7: '7 days',
    presetExpiry30: '30 days',
    customDate: 'Custom date',
    pendingTab: 'Pending',
    pendingSubtitle: 'Enquiries not yet confirmed',
    pendingNew: 'New enquiry',
    pendingNewJob: 'New pending enquiry',
    saveAsPending: 'Save as pending',
    pushToSchedule: 'Push to schedule',
    confirmPushTitle: 'Confirm and schedule',
    pendingPill: 'Pending',
    pendingClashWarning: 'Pencilled-in pending enquiry overlaps',
    suggestionsTitle: 'Possible clash — review before scheduling',
    suggestionsIntro: 'This time and team conflict with an existing job. Pick a workaround:',
    suggestionAltInstaller: 'Different installer, same time',
    suggestionAltTime: 'Same installer, different time',
    applySuggestion: 'Apply',
    saveAnyway: 'Save anyway',
    cancelSave: 'Cancel',
    noAltInstallers: 'No suitable installers free at this time',
    noAltTimes: 'No nearby slots free for this team',
    bookedAt: 'busy with',
    suggestedTime: 'Free at',
    noPending: 'No pending enquiries',
    clashesNeedResolving: 'clash(es) need attention before scheduling',
    clashedInstaller: 'is double-booked',
    replaceWith: 'Replace with',
    keepClashed: 'Keep anyway',
    keptClashed: 'Kept (will save anyway)',
    resolvedSwap: 'Swapping to',
    chooseSubstitute: 'Choose a substitute',
    orShiftWholeTeam: 'Or shift the whole job to a different time',
    applyAndPush: 'Apply changes & push',
    applyAndSave: 'Apply changes & save',
    allClashesResolved: 'All clashes resolved',
    unresolvedClashes: 'unresolved',

    // Role / approval workflow
    roleSales: 'Sales', roleScheduler: 'Scheduler',
    roleSwitchHint: 'Role · saved on this device',
    viewingAs: 'Viewing as',
    sendToScheduler: 'Send to scheduler',
    sentForApproval: 'Sent for approval',
    awaitingApproval: 'Awaiting scheduler approval',
    approvalsTab: 'Approvals',
    approvalsSubtitle: 'Pending requests from sales',
    approveAndSchedule: 'Approve & schedule',
    sendBackToSales: 'Send back to sales',
    noApprovals: 'No requests awaiting approval',
    sentBy: 'Sent by',
    sentAt: 'sent',
    schedulerOnly: 'Scheduler only',
    salesNoticeAwaiting: 'Locked while scheduler reviews. Tap "Send back" if you need to edit.',

    // Workload preview popup
    loadPreviewTitle: 'Schedule load on this date',
    loadPreviewIntro: 'Review team workload before sending. If too packed, repropose another date with the client.',
    selectedDateLoad: 'Load on',
    totalJobsThatDay: 'jobs this day',
    yourTeamThatDay: 'Your assigned team — already on this day',
    noJobsForTeam: 'Your team has nothing else booked this day',
    nearbyDates: 'Nearby dates — total jobs',
    nearbyHint: 'Tap a quieter day to switch to it',
    sendAnyway: 'Send to scheduler',
    reconsiderDate: 'Cancel — pick another date',
    busyDay: 'busy', quiet: 'quiet', moderate: 'moderate',
    switchedDate: 'Date switched — review and resend',

    // Notifications / overdue
    notifBell: 'Alerts',
    overdueOne: 'overdue job',
    overdueMany: 'overdue jobs',
    noAlerts: 'No alerts — all jobs on track',
    alertOverdue: 'Job overdue',
    overdueBy: 'overdue by',
    noPhotosYet: 'No completion photos uploaded yet',
    remindNow: 'Remind installer + sales',
    reminderSent: 'Reminder sent',
    clearAlert: 'Dismiss',
    hr: 'hr', mins: 'min',
    checkpoint2hr: '2-hour checkpoint passed without completion',
    endOfDayMissed: 'End of work day (6 PM) reached, job not closed',
    overduePastEnd: 'Past scheduled end time',
    alertSubtitle: 'Jobs needing attention',

    // Completion with photos
    completionPhotos: 'Completion photos',
    addCompletionPhoto: '+ Add completion photo',
    photosRequiredToComplete: 'Add at least one completion photo before marking done.',
    schedulerOverride: 'Scheduler override',
    schedulerCanComplete: 'As scheduler, you may complete the job and optionally attach photos on behalf of the installer.',
    attachPhotosOptional: 'Attach photos (optional)',
    markComplete: 'Mark complete',
    photosUploaded: 'photo(s) attached',

    // Installer role + dashboard
    roleInstaller: 'Installer',
    installerSignedInAs: 'Signed in as',
    installerSwitchSelf: 'Sign in as installer',
    installerHi: 'Hi',
    installerToday: "Today's run",
    installerNowLabel: 'Now',
    installerUpNext: 'Up next',
    installerLaterToday: 'Later today',
    installerThisWeek: 'This week',
    installerNothingToday: 'Nothing on today',
    installerRestDay: 'Enjoy the rest day — no jobs assigned to you.',
    installerNothingUpcoming: 'Nothing else booked yet.',
    installerStartsIn: 'Starts in',
    installerStartedAgo: 'Started',
    installerAgo: 'ago',
    installerOngoing: 'Ongoing',
    installerOverrunning: 'Overrunning',
    installerOpenJob: 'Open job',
    installerCallSales: 'Call sales',
    installerHistoryTab: 'Past',
    installerHistoryTitle: 'Past jobs',
    installerHistorySubtitle: 'Add photos, DO or notes after completion',
    installerNoHistory: 'No completed jobs yet',
    installerPostCompletionEdits: 'Post-completion add-ons',
    installerPostCompletionHint: 'Anything you add here will alert the sales POC.',
    installerMyJobsTab: 'My jobs',
    installerJobsAssignedCount: 'jobs',

    // Job chat thread
    jobChatTitle: 'Job chat',
    jobChatSubtitle: 'Live thread between sales, scheduler & installers',
    jobChatPlaceholder: 'Type a message…',
    jobChatLive: 'Live',
    jobChatSyncing: 'Syncing…',
    jobChatSyncedAgo: 'synced',
    jobChatSecondsAgo: 's ago',
    jobChatJustNow: 'just now',
    jobChatNoMessages: 'No messages yet — start the thread.',
    jobChatYou: 'You',
    jobChatSalesRole: 'Sales',
    jobChatSchedulerRole: 'Scheduler',
    jobChatInstallerRole: 'Installer',
    jobChatSendBtn: 'Send',
    jobChatRecordVoice: 'Record',
    jobChatRecordingTap: 'Tap to stop',
    jobChatRecording: 'Recording',
    jobChatVoiceNote: 'Voice note',
    jobChatPlay: 'Play',
    jobChatPause: 'Pause',
    jobChatVoiceFallback: 'Mic unavailable — saved as mock voice note',
    jobChatNotifiedSales: 'Sales POC notified',
    jobChatComment: 'Comment',
    jobChatVoice: 'Voice note',
    jobChatPhotoAdded: 'Photo added',
    jobChatDOAdded: 'DO attached',
  },
  zh: {
    appPhase: '阶段 0',
    schedule: '排程', assistant: '助手',
    companySchedule: '公司排程',
    new: '新增', noJobs: '今天没有安排',
    strictOnTime: '严格准时', flexibleWindow: '弹性时段',
    productionTick: '生产 ✓', doTick: '送货单 ✓', file: '附件',
    backToSchedule: '排程', editJob: '编辑工作', newJob: '新工作',
    clashesDetected: '项冲突',
    date: '日期', day: '星期', client: '客户', clientPick: '选择客户…',
    addNew: '+ 新增…', otherBlank: '其他（留空）',
    jobDescription: '工作描述',
    jobDescPlaceholder: '安装/制作内容…',
    locationAddress: '地点 / 地址',
    locationPlaceholder: '例：滨海湾金沙 B1',
    timeStart: '开始时间', timeEnd: '结束时间（可选）',
    pickTime: '选择时间…',
    punctuality: '准时要求',
    productionReady: '生产就绪', doIssued: '已开送货单',
    salesPOC: '销售 / 联络人', pickSales: '选择…',
    installers: '安装人员', suggest: '建议', hide: '隐藏',
    suggestedBased: '根据工作描述推荐',
    added: '✓ 已加', addBtn: '+ 加入',
    attachment: '附件',
    uploadBrief: '上传简报 / PTW / 图纸',
    delete: '删除', cancel: '取消', save: '保存',
    askPlaceholder: '提问、搜索或描述工作…',
    assistantSubtitle: '可联网搜索',
    expand: '展开',
    proposedEntry: '建议条目',
    discard: '丢弃', confirmAdd: '确认加入',
    thinking: '思考中…',
    settings: '设置', language: '语言', languageHint: '保存在此设备',
    aiSuggested: 'AI 建议', tapToUse: '点击使用',
    readingFile: '正在读取附件…',
    addNewClientPrompt: '新客户名称',
    addNewSalesPrompt: '新销售 / 联络人',
    confirmDiscarded: '好的，已丢弃。',
    notifications: '通知',
    willNotify: '保存时将通知',
    notEnrolled: '未注册',
    notifySaveBtn: '保存并通知',
    saveOnly: '只保存，不通知',
    notifyingNow: '正在发送 Telegram 消息…',
    notifiedSuccess: '已通知',
    notifiedSomeFailed: '未注册',
    onlyChangedNotify: '当时间、人员、地点或附件改变时重发',
    viaTelegram: '通过 Telegram',
    clientPOC: '客户联络电话',
    clientPOCPlaceholder: '电话号码（可选）',
    files: '文件',
    links: '下载链接',
    addLink: '+ 添加链接',
    pasteUrl: '粘贴链接（Dropbox、WeTransfer、Drive…）',
    linkLabel: '标签（可选）',
    linkLabelPlaceholder: '例：客户艺术稿',
    sectionPTW: 'Permit-to-Work',
    sectionBCA: 'BCA',
    sectionOthers: '其他',
    invalidUrl: '链接格式不正确',
    copied: '已复制',
    open: '打开',
    copy: '复制',
    contactPerson: '联络人',
    searchOrAddPerson: '搜索或添加联络人…',
    addPersonAs: '添加为新联络人',
    productionPhotos: '生产照片',
    addPhoto: '+ 添加照片',
    photoCount: '张',
    productionInstructions: '生产说明',
    productionInstructionsPlaceholder: '给生产团队的备注（可选）…',
    doShort: 'DO？',
    doProof: '签收 DO / 凭证',
    uploadDOPhoto: '拍照或上传签收 DO',
    completeJob: '标记完成',
    confirmComplete: '将此工作标记为已完成？',
    completed: '已完成',
    completedTab: '历史',
    restoreJob: '恢复到排程',
    confirmRestore: '将此工作恢复到当前排程？',
    noCompleted: '暂无已完成工作',
    searchJobs: '搜索工作、客户、地点…',
    filterAll: '全部',
    filterToday: '今天',
    filterWeek: '本周',
    filterUpcoming: '即将',
    view: '视图',
    viewList: '列表',
    viewWeek: '周',
    viewMonth: '月',
    closeGallery: '关闭',
    photoOf: '/',
    designation: '职位 / 角色',
    designationPlaceholder: '例：市场经理',
    aiSuggest: '建议',
    aiImprove: '润色',
    aiImproving: '正在润色文字…',
    aiSuggesting: '正在阅读附件…',
    aiOriginal: '您的原文',
    aiSuggested2: '建议版本',
    aiAccept: '采用此版本',
    aiKeep: '保留原文',
    linkAdded: '已添加',
    linkExpires: '到期',
    setExpiry: '设置到期日',
    noExpiry: '未设到期日',
    expiryToday: '今日到期',
    expiryTomorrow: '明日到期',
    expiresInDays: '剩余',
    days: '天',
    expired: '已过期',
    presetExpiryWT: 'WeTransfer (3天)',
    presetExpiry7: '7 天',
    presetExpiry30: '30 天',
    customDate: '自定义日期',
    pendingTab: '待定',
    pendingSubtitle: '已询价但未确认',
    pendingNew: '新询价',
    pendingNewJob: '新待定询价',
    saveAsPending: '保存为待定',
    pushToSchedule: '推送到排程',
    confirmPushTitle: '确认并排程',
    pendingPill: '待定',
    pendingClashWarning: '与待定询价时段重叠',
    suggestionsTitle: '可能冲突 — 排程前请查看',
    suggestionsIntro: '此时段或人员与现有工作冲突。请选择处理方式：',
    suggestionAltInstaller: '换个安装人员，同样时间',
    suggestionAltTime: '同一安装人员，换个时间',
    applySuggestion: '采用',
    saveAnyway: '仍要保存',
    cancelSave: '取消',
    noAltInstallers: '此时段没有合适的可用人员',
    noAltTimes: '此团队没有附近的空闲时段',
    bookedAt: '已安排',
    suggestedTime: '空闲于',
    noPending: '暂无待定询价',
    clashesNeedResolving: '项冲突需在排程前处理',
    clashedInstaller: '已被双重预订',
    replaceWith: '替换为',
    keepClashed: '仍然保留',
    keptClashed: '已保留（仍会保存）',
    resolvedSwap: '将换成',
    chooseSubstitute: '选择替代人员',
    orShiftWholeTeam: '或将整个工作改到其他时间',
    applyAndPush: '应用更改并推送',
    applyAndSave: '应用更改并保存',
    allClashesResolved: '所有冲突已解决',
    unresolvedClashes: '未解决',

    // Role / approval workflow
    roleSales: '销售', roleScheduler: '排程员',
    roleSwitchHint: '角色 · 保存在此设备',
    viewingAs: '当前身份',
    sendToScheduler: '发给排程员',
    sentForApproval: '已发送审批',
    awaitingApproval: '等待排程员批准',
    approvalsTab: '审批',
    approvalsSubtitle: '销售发来的待审请求',
    approveAndSchedule: '批准并排程',
    sendBackToSales: '退回给销售',
    noApprovals: '暂无待审请求',
    sentBy: '发送者',
    sentAt: '发送于',
    schedulerOnly: '仅排程员',
    salesNoticeAwaiting: '排程员审核中暂时锁定。如需修改，请按"退回"。',

    // Workload preview popup
    loadPreviewTitle: '此日工作量',
    loadPreviewIntro: '发送前审核团队工作量。如太满，可与客户重订日期。',
    selectedDateLoad: '当日负担',
    totalJobsThatDay: '项工作',
    yourTeamThatDay: '您选的人员 — 当日已有安排',
    noJobsForTeam: '您选的团队当日没有其他工作',
    nearbyDates: '附近日期 — 总工作数',
    nearbyHint: '点击较空闲的日期切换',
    sendAnyway: '发给排程员',
    reconsiderDate: '取消 — 换日期',
    busyDay: '繁忙', quiet: '空闲', moderate: '一般',
    switchedDate: '日期已切换 — 请重新审核并发送',

    // Notifications / overdue
    notifBell: '提醒',
    overdueOne: '项逾期工作',
    overdueMany: '项逾期工作',
    noAlerts: '无提醒 — 所有工作正常',
    alertOverdue: '工作逾期',
    overdueBy: '已逾期',
    noPhotosYet: '尚未上传完成照片',
    remindNow: '提醒安装人员 + 销售',
    reminderSent: '提醒已发送',
    clearAlert: '清除',
    hr: '小时', mins: '分',
    checkpoint2hr: '2 小时检查点已过，工作未完成',
    endOfDayMissed: '工作日结束（下午 6 点）已到，工作未关闭',
    overduePastEnd: '已超过预定结束时间',
    alertSubtitle: '需关注的工作',

    // Completion with photos
    completionPhotos: '完成照片',
    addCompletionPhoto: '+ 添加完成照片',
    photosRequiredToComplete: '完成前至少添加一张完成照片。',
    schedulerOverride: '排程员越权',
    schedulerCanComplete: '作为排程员，您可代替安装人员完成工作，并可选择附加照片。',
    attachPhotosOptional: '附加照片（可选）',
    markComplete: '标记完成',
    photosUploaded: '张照片已附加',

    // Installer role + dashboard
    roleInstaller: '安装人员',
    installerSignedInAs: '当前身份',
    installerSwitchSelf: '切换安装人员',
    installerHi: '你好',
    installerToday: '今日工作',
    installerNowLabel: '当前',
    installerUpNext: '下一项',
    installerLaterToday: '今天稍后',
    installerThisWeek: '本周',
    installerNothingToday: '今天没有工作',
    installerRestDay: '休息日 — 今日无安排。',
    installerNothingUpcoming: '暂无后续安排。',
    installerStartsIn: '将在',
    installerStartedAgo: '已开始',
    installerAgo: '前',
    installerOngoing: '进行中',
    installerOverrunning: '超时',
    installerOpenJob: '打开工作',
    installerCallSales: '联系销售',
    installerHistoryTab: '历史',
    installerHistoryTitle: '历史工作',
    installerHistorySubtitle: '完工后补加照片、送货单或备注',
    installerNoHistory: '暂无已完成工作',
    installerPostCompletionEdits: '完工后补充',
    installerPostCompletionHint: '在此添加的内容将通知销售联络人。',
    installerMyJobsTab: '我的',
    installerJobsAssignedCount: '项',

    // Job chat thread
    jobChatTitle: '工作聊天',
    jobChatSubtitle: '销售、排程员与安装人员实时沟通',
    jobChatPlaceholder: '输入消息…',
    jobChatLive: '实时',
    jobChatSyncing: '同步中…',
    jobChatSyncedAgo: '同步于',
    jobChatSecondsAgo: '秒前',
    jobChatJustNow: '刚刚',
    jobChatNoMessages: '暂无消息 — 发起对话吧。',
    jobChatYou: '我',
    jobChatSalesRole: '销售',
    jobChatSchedulerRole: '排程员',
    jobChatInstallerRole: '安装',
    jobChatSendBtn: '发送',
    jobChatRecordVoice: '录音',
    jobChatRecordingTap: '点击停止',
    jobChatRecording: '录音中',
    jobChatVoiceNote: '语音留言',
    jobChatPlay: '播放',
    jobChatPause: '暂停',
    jobChatVoiceFallback: '麦克风不可用 — 已保存为模拟语音',
    jobChatNotifiedSales: '已通知销售联络人',
    jobChatComment: '留言',
    jobChatVoice: '语音留言',
    jobChatPhotoAdded: '照片已添加',
    jobChatDOAdded: '送货单已附',
  },
  bn: {
    appPhase: 'ফেজ ০',
    schedule: 'সময়সূচী', assistant: 'সহকারী',
    companySchedule: 'কোম্পানির সময়সূচী',
    new: 'নতুন', noJobs: 'কোনো কাজ নেই',
    strictOnTime: 'কড়া সময়', flexibleWindow: 'নমনীয় সময়',
    productionTick: 'প্রোডাকশন ✓', doTick: 'DO ✓', file: 'ফাইল',
    backToSchedule: 'সময়সূচী', editJob: 'কাজ সম্পাদনা', newJob: 'নতুন কাজ',
    clashesDetected: 'টি দ্বন্দ্ব পাওয়া গেছে',
    date: 'তারিখ', day: 'দিন', client: 'ক্লায়েন্ট', clientPick: 'ক্লায়েন্ট বেছে নিন…',
    addNew: '+ নতুন যোগ…', otherBlank: 'অন্যান্য (খালি)',
    jobDescription: 'কাজের বিবরণ',
    jobDescPlaceholder: 'কী ইনস্টল / তৈরি হচ্ছে…',
    locationAddress: 'অবস্থান / ঠিকানা',
    locationPlaceholder: 'যেমন: Marina Bay Sands, Hall B1',
    timeStart: 'শুরুর সময়', timeEnd: 'শেষ সময় (ঐচ্ছিক)',
    pickTime: 'সময় বাছাই…',
    punctuality: 'সময়ানুবর্তিতা',
    productionReady: 'প্রোডাকশন প্রস্তুত', doIssued: 'DO ইস্যু হয়েছে',
    salesPOC: 'সেলস / যোগাযোগ', pickSales: 'বাছাই…',
    installers: 'ইনস্টলার', suggest: 'প্রস্তাব', hide: 'লুকান',
    suggestedBased: 'কাজের বিবরণ অনুযায়ী প্রস্তাব',
    added: '✓ যোগ হয়েছে', addBtn: '+ যোগ করুন',
    attachment: 'সংযুক্তি',
    uploadBrief: 'ব্রিফ / PTW / ড্রয়িং আপলোড',
    delete: 'মুছুন', cancel: 'বাতিল', save: 'সংরক্ষণ',
    askPlaceholder: 'প্রশ্ন করুন, সার্চ করুন বা কাজ বর্ণনা করুন…',
    assistantSubtitle: 'ওয়েব সার্চসহ',
    expand: 'বড় করুন',
    proposedEntry: 'প্রস্তাবিত এন্ট্রি',
    discard: 'বাতিল', confirmAdd: 'নিশ্চিত করে যোগ',
    thinking: 'ভাবছি…',
    settings: 'সেটিংস', language: 'ভাষা', languageHint: 'এই ডিভাইসে সংরক্ষিত',
    aiSuggested: 'AI প্রস্তাব', tapToUse: 'ব্যবহার করতে ট্যাপ',
    readingFile: 'সংযুক্তি পড়া হচ্ছে…',
    addNewClientPrompt: 'নতুন ক্লায়েন্টের নাম',
    addNewSalesPrompt: 'নতুন সেলস / যোগাযোগের নাম',
    confirmDiscarded: 'ঠিক আছে, বাতিল করা হয়েছে।',
    notifications: 'বিজ্ঞপ্তি',
    willNotify: 'সেভ করলে নোটিফাই হবে',
    notEnrolled: 'নথিভুক্ত নয়',
    notifySaveBtn: 'সেভ ও নোটিফাই',
    saveOnly: 'নোটিফাই ছাড়া সেভ',
    notifyingNow: 'Telegram বার্তা পাঠানো হচ্ছে…',
    notifiedSuccess: 'নোটিফাই হয়েছে',
    notifiedSomeFailed: 'নথিভুক্ত নয়',
    onlyChangedNotify: 'সময়, ইনস্টলার, স্থান বা সংযুক্তি বদলালে আবার নোটিফাই',
    viaTelegram: 'Telegram-এ',
    clientPOC: 'ক্লায়েন্ট যোগাযোগ',
    clientPOCPlaceholder: 'ফোন নম্বর (ঐচ্ছিক)',
    files: 'ফাইল',
    links: 'ডাউনলোড লিংক',
    addLink: '+ লিংক যোগ',
    pasteUrl: 'URL পেস্ট করুন (Dropbox, WeTransfer, Drive…)',
    linkLabel: 'লেবেল (ঐচ্ছিক)',
    linkLabelPlaceholder: 'যেমন: ক্লায়েন্ট আর্টওয়ার্ক',
    sectionPTW: 'Permit-to-Work',
    sectionBCA: 'BCA',
    sectionOthers: 'অন্যান্য',
    invalidUrl: 'এটি একটি বৈধ URL নয়',
    copied: 'কপি হয়েছে',
    open: 'খুলুন',
    copy: 'কপি',
    contactPerson: 'যোগাযোগের ব্যক্তি',
    searchOrAddPerson: 'খুঁজুন বা নতুন যোগ করুন…',
    addPersonAs: 'নতুন যোগাযোগ হিসেবে যোগ করুন',
    productionPhotos: 'প্রোডাকশন ছবি',
    addPhoto: '+ ছবি যোগ',
    photoCount: 'ছবি',
    productionInstructions: 'প্রোডাকশন নির্দেশনা',
    productionInstructionsPlaceholder: 'প্রোডাকশন টিমের জন্য নোট (ঐচ্ছিক)…',
    doShort: 'DO?',
    doProof: 'স্বাক্ষরিত DO / প্রমাণ',
    uploadDOPhoto: 'ছবি তুলুন বা স্বাক্ষরিত DO আপলোড',
    completeJob: 'কাজ সম্পন্ন',
    confirmComplete: 'এই কাজটি সম্পন্ন হিসেবে চিহ্নিত করবেন?',
    completed: 'সম্পন্ন',
    completedTab: 'সম্পন্ন',
    restoreJob: 'সময়সূচীতে ফেরান',
    confirmRestore: 'এই কাজটি সক্রিয় সময়সূচীতে ফেরাবেন?',
    noCompleted: 'এখনও কোনো সম্পন্ন কাজ নেই',
    searchJobs: 'কাজ, ক্লায়েন্ট, স্থান খুঁজুন…',
    filterAll: 'সব',
    filterToday: 'আজ',
    filterWeek: 'এই সপ্তাহ',
    filterUpcoming: 'আসন্ন',
    view: 'ভিউ',
    viewList: 'লিস্ট',
    viewWeek: 'সপ্তাহ',
    viewMonth: 'মাস',
    closeGallery: 'বন্ধ',
    photoOf: '/',
    designation: 'পদবী / ভূমিকা',
    designationPlaceholder: 'যেমন: মার্কেটিং ম্যানেজার',
    aiSuggest: 'প্রস্তাব',
    aiImprove: 'উন্নত করুন',
    aiImproving: 'আপনার লেখা ঠিক করা হচ্ছে…',
    aiSuggesting: 'সংযুক্তি পড়া হচ্ছে…',
    aiOriginal: 'আপনার মূল লেখা',
    aiSuggested2: 'প্রস্তাবিত',
    aiAccept: 'এটা ব্যবহার করুন',
    aiKeep: 'আমার ভাষা রাখুন',
    linkAdded: 'যোগ করা হয়েছে',
    linkExpires: 'মেয়াদ শেষ',
    setExpiry: 'মেয়াদ সেট করুন',
    noExpiry: 'কোনো মেয়াদ সেট নেই',
    expiryToday: 'আজ মেয়াদ শেষ',
    expiryTomorrow: 'আগামীকাল মেয়াদ শেষ',
    expiresInDays: 'মেয়াদ শেষ হবে',
    days: 'দিনে',
    expired: 'মেয়াদ উত্তীর্ণ',
    presetExpiryWT: 'WeTransfer (৩ দিন)',
    presetExpiry7: '৭ দিন',
    presetExpiry30: '৩০ দিন',
    customDate: 'নিজের তারিখ',
    pendingTab: 'মুলতুবি',
    pendingSubtitle: 'নিশ্চিত হয়নি এমন অনুসন্ধান',
    pendingNew: 'নতুন অনুসন্ধান',
    pendingNewJob: 'নতুন মুলতুবি অনুসন্ধান',
    saveAsPending: 'মুলতুবি হিসেবে সেভ',
    pushToSchedule: 'সময়সূচীতে পাঠান',
    confirmPushTitle: 'নিশ্চিত করে শিডিউল করুন',
    pendingPill: 'মুলতুবি',
    pendingClashWarning: 'মুলতুবি অনুসন্ধানের সাথে সময় মিলছে',
    suggestionsTitle: 'সম্ভাব্য দ্বন্দ্ব — শিডিউল করার আগে দেখুন',
    suggestionsIntro: 'এই সময় বা দল চলমান কাজের সাথে দ্বন্দ্ব করছে। বিকল্প বেছে নিন:',
    suggestionAltInstaller: 'অন্য ইনস্টলার, একই সময়',
    suggestionAltTime: 'একই ইনস্টলার, অন্য সময়',
    applySuggestion: 'প্রয়োগ',
    saveAnyway: 'তবুও সেভ',
    cancelSave: 'বাতিল',
    noAltInstallers: 'এই সময়ে উপযুক্ত কোনো ইনস্টলার নেই',
    noAltTimes: 'এই দলের জন্য কাছাকাছি কোনো ফাঁকা সময় নেই',
    bookedAt: 'ব্যস্ত',
    suggestedTime: 'ফাঁকা',
    noPending: 'কোনো মুলতুবি অনুসন্ধান নেই',
    clashesNeedResolving: 'টি দ্বন্দ্ব শিডিউলের আগে দেখা প্রয়োজন',
    clashedInstaller: 'দুইবার বুক হয়েছে',
    replaceWith: 'বদলান',
    keepClashed: 'যেমন আছে রাখুন',
    keptClashed: 'রাখা হয়েছে (তবুও সেভ হবে)',
    resolvedSwap: 'বদলে',
    chooseSubstitute: 'বিকল্প বেছে নিন',
    orShiftWholeTeam: 'বা পুরো কাজ অন্য সময়ে সরান',
    applyAndPush: 'প্রয়োগ করে পাঠান',
    applyAndSave: 'প্রয়োগ করে সেভ',
    allClashesResolved: 'সব দ্বন্দ্ব সমাধান হয়েছে',
    unresolvedClashes: 'অনিষ্পন্ন',

    // Role / approval workflow
    roleSales: 'সেলস', roleScheduler: 'শিডিউলার',
    roleSwitchHint: 'ভূমিকা · এই ডিভাইসে সেভ',
    viewingAs: 'দেখছেন',
    sendToScheduler: 'শিডিউলারকে পাঠান',
    sentForApproval: 'অনুমোদনের জন্য পাঠানো',
    awaitingApproval: 'শিডিউলারের অনুমোদনের অপেক্ষায়',
    approvalsTab: 'অনুমোদন',
    approvalsSubtitle: 'সেলস থেকে অনুমোদনের অপেক্ষায়',
    approveAndSchedule: 'অনুমোদন করে শিডিউল',
    sendBackToSales: 'সেলসে ফেরত পাঠান',
    noApprovals: 'কোনো অনুরোধ অপেক্ষায় নেই',
    sentBy: 'পাঠিয়েছেন',
    sentAt: 'পাঠানো',
    schedulerOnly: 'শুধু শিডিউলার',
    salesNoticeAwaiting: 'শিডিউলার দেখছেন, লক করা। সম্পাদনা করতে "ফেরত পাঠান" চাপুন।',

    // Workload preview popup
    loadPreviewTitle: 'এই দিনের কাজের চাপ',
    loadPreviewIntro: 'পাঠানোর আগে দলের কাজের চাপ দেখুন। বেশি ব্যস্ত হলে ক্লায়েন্টের সাথে অন্য তারিখ আলোচনা করুন।',
    selectedDateLoad: 'নির্বাচিত দিনের চাপ',
    totalJobsThatDay: 'টি কাজ',
    yourTeamThatDay: 'আপনার দল — এই দিনে ইতিমধ্যেই বুকড',
    noJobsForTeam: 'আপনার দলের এই দিনে আর কিছু নেই',
    nearbyDates: 'কাছাকাছি তারিখ — মোট কাজ',
    nearbyHint: 'কম ব্যস্ত দিনে যেতে ক্লিক করুন',
    sendAnyway: 'শিডিউলারকে পাঠান',
    reconsiderDate: 'বাতিল — অন্য তারিখ',
    busyDay: 'ব্যস্ত', quiet: 'ফাঁকা', moderate: 'মাঝারি',
    switchedDate: 'তারিখ বদলানো হয়েছে — পুনরায় দেখে পাঠান',

    // Notifications / overdue
    notifBell: 'অ্যালার্ট',
    overdueOne: 'টি বিলম্বিত কাজ',
    overdueMany: 'টি বিলম্বিত কাজ',
    noAlerts: 'কোনো অ্যালার্ট নেই — সব ঠিক',
    alertOverdue: 'কাজ বিলম্বিত',
    overdueBy: 'বিলম্ব',
    noPhotosYet: 'সমাপ্তি ছবি এখনো আপলোড হয়নি',
    remindNow: 'ইনস্টলার + সেলসকে স্মরণ করান',
    reminderSent: 'স্মরণ পাঠানো হয়েছে',
    clearAlert: 'বাতিল',
    hr: 'ঘ', mins: 'মি',
    checkpoint2hr: '২-ঘণ্টার চেকপয়েন্ট পেরিয়েছে, কাজ শেষ হয়নি',
    endOfDayMissed: 'কর্মদিবস শেষ (সন্ধ্যা ৬টা), কাজ বন্ধ হয়নি',
    overduePastEnd: 'নির্ধারিত শেষ সময় পেরিয়েছে',
    alertSubtitle: 'মনোযোগ প্রয়োজন এমন কাজ',

    // Completion with photos
    completionPhotos: 'সমাপ্তি ছবি',
    addCompletionPhoto: '+ সমাপ্তি ছবি যোগ করুন',
    photosRequiredToComplete: 'সমাপ্ত চিহ্নিত করার আগে অন্তত একটি সমাপ্তি ছবি যোগ করুন।',
    schedulerOverride: 'শিডিউলার ওভাররাইড',
    schedulerCanComplete: 'শিডিউলার হিসেবে, ছবি সংযুক্ত করে বা ছাড়াই সমাপ্ত করতে পারেন।',
    attachPhotosOptional: 'ছবি যোগ করুন (ঐচ্ছিক)',
    markComplete: 'সমাপ্ত চিহ্নিত',
    photosUploaded: 'টি ছবি সংযুক্ত',

    // Installer role + dashboard
    roleInstaller: 'ইনস্টলার',
    installerSignedInAs: 'সাইন ইন',
    installerSwitchSelf: 'ইনস্টলার নির্বাচন',
    installerHi: 'হ্যালো',
    installerToday: 'আজকের কাজ',
    installerNowLabel: 'এখন',
    installerUpNext: 'পরবর্তী',
    installerLaterToday: 'আজ পরে',
    installerThisWeek: 'এই সপ্তাহ',
    installerNothingToday: 'আজ কোনো কাজ নেই',
    installerRestDay: 'বিশ্রামের দিন — আজ কোনো কাজ বরাদ্দ নেই।',
    installerNothingUpcoming: 'সামনে আর কিছু নেই।',
    installerStartsIn: 'শুরু হবে',
    installerStartedAgo: 'শুরু হয়েছে',
    installerAgo: 'আগে',
    installerOngoing: 'চলছে',
    installerOverrunning: 'সময় পার',
    installerOpenJob: 'কাজ খুলুন',
    installerCallSales: 'সেলসকে কল',
    installerHistoryTab: 'অতীত',
    installerHistoryTitle: 'অতীত কাজ',
    installerHistorySubtitle: 'সমাপ্তির পর ছবি, DO বা মন্তব্য যোগ করুন',
    installerNoHistory: 'কোনো সম্পন্ন কাজ নেই',
    installerPostCompletionEdits: 'সমাপ্তির পর সংযোজন',
    installerPostCompletionHint: 'এখানে যোগ করা সব কিছু সেলস POC-কে জানানো হবে।',
    installerMyJobsTab: 'আমার',
    installerJobsAssignedCount: 'কাজ',

    // Job chat thread
    jobChatTitle: 'কাজের চ্যাট',
    jobChatSubtitle: 'সেলস, শিডিউলার ও ইনস্টলারের লাইভ থ্রেড',
    jobChatPlaceholder: 'বার্তা লিখুন…',
    jobChatLive: 'লাইভ',
    jobChatSyncing: 'সিঙ্ক হচ্ছে…',
    jobChatSyncedAgo: 'সিঙ্ক হয়েছে',
    jobChatSecondsAgo: 'সেকেন্ড আগে',
    jobChatJustNow: 'এইমাত্র',
    jobChatNoMessages: 'কোনো বার্তা নেই — কথা শুরু করুন।',
    jobChatYou: 'আপনি',
    jobChatSalesRole: 'সেলস',
    jobChatSchedulerRole: 'শিডিউলার',
    jobChatInstallerRole: 'ইনস্টলার',
    jobChatSendBtn: 'পাঠান',
    jobChatRecordVoice: 'রেকর্ড',
    jobChatRecordingTap: 'থামাতে চাপুন',
    jobChatRecording: 'রেকর্ড হচ্ছে',
    jobChatVoiceNote: 'ভয়েস নোট',
    jobChatPlay: 'চালান',
    jobChatPause: 'থামান',
    jobChatVoiceFallback: 'মাইক্রোফোন উপলব্ধ নয় — মক ভয়েস হিসাবে সেভ',
    jobChatNotifiedSales: 'সেলস POC-কে জানানো হয়েছে',
    jobChatComment: 'মন্তব্য',
    jobChatVoice: 'ভয়েস নোট',
    jobChatPhotoAdded: 'ছবি যোগ',
    jobChatDOAdded: 'DO যোগ',
  },
};

// LocalStorage shim for artifact env (no localStorage allowed) - falls back to in-memory
const _memStore = {};
const storage = {
  get: (k) => {
    try { return typeof window !== 'undefined' && window.localStorage ? window.localStorage.getItem(k) : _memStore[k]; }
    catch { return _memStore[k]; }
  },
  set: (k, v) => {
    try { if (typeof window !== 'undefined' && window.localStorage) window.localStorage.setItem(k, v); else _memStore[k] = v; }
    catch { _memStore[k] = v; }
  }
};

// ============ DESIGN TOKENS ============
const C = {
  bg: '#F4F1EC', card: '#FFFFFF', ink: '#1A1815', ink2: '#5C564E',
  muted: '#8B8478', line: '#E8E2D7', accent: '#B5523D', accent2: '#F5E8E3',
  good: '#3F7D5C', goodBg: '#E8F0EB', warn: '#C8893D', warnBg: '#F8EFDF',
  bad: '#A83D3D', badBg: '#F5E0E0', red: '#D14545', blue: '#3D6FB5',
};
const F = {
  display: "'Fraunces', Georgia, serif",
  body: "'IBM Plex Sans', -apple-system, sans-serif",
};

// ============ PLACEHOLDER DATA — replace with real ============
const STAFF = [
  { id: 1, name: 'Aaron Tan', role: 'Install Lead', strengths: ['LED rigging', 'Electrical', 'Site lead'], weaknesses: ['Carpentry'], exp: 8, tgEnrolled: true, tgLang: 'en' },
  { id: 2, name: 'Ben Lim', role: 'Installer', strengths: ['Vinyl', 'Graphics application', 'Solo work'], weaknesses: ['Heavy structures'], exp: 3, tgEnrolled: true, tgLang: 'en' },
  { id: 3, name: 'Chong Wei', role: 'Installer', strengths: ['Carpentry', 'Booth assembly', 'Power tools'], weaknesses: ['Electrical'], exp: 6, tgEnrolled: true, tgLang: 'zh' },
  { id: 4, name: 'Daniel Ng', role: 'Install Lead', strengths: ['Hoarding', 'Site safety', 'PTW familiar'], weaknesses: ['LED'], exp: 10, tgEnrolled: true, tgLang: 'en' },
  { id: 5, name: 'Eddie Goh', role: 'Installer', strengths: ['Acrylic install', 'Precision work'], weaknesses: ['Heights'], exp: 4, tgEnrolled: false, tgLang: 'en' },
  { id: 6, name: 'Faizal R.', role: 'Installer', strengths: ['Heights', 'Rigging', 'Heavy lifting'], weaknesses: [], exp: 5, tgEnrolled: true, tgLang: 'bn' },
  { id: 7, name: 'Gary Sim', role: 'Production Lead', strengths: ['Project planning', 'Quality check'], weaknesses: [], exp: 9, tgEnrolled: true, tgLang: 'zh' },
];

const CLIENTS = ['Uniqlo SG', 'DBS Bank', 'CDL Properties', 'Watsons', 'Marina Bay Sands', 'Capitaland', 'NTUC FairPrice', 'Shopee SG', 'Grab', 'OCBC'];
const SALES_TEAM = ['Wei Ling', 'Marcus', 'Priya', 'Jaslyn'];

const TIME_SLOTS = (() => {
  const slots = [];
  for (let h = 7; h < 22; h++) {
    for (let m = 0; m < 60; m += 30) {
      const ampm = h >= 12 ? 'PM' : 'AM';
      const dh = h > 12 ? h - 12 : (h === 0 ? 12 : h);
      slots.push(`${dh}:${String(m).padStart(2, '0')} ${ampm}`);
    }
  }
  return slots;
})();

// ============ MOCK SCHEDULE ============
// status: 'scheduled' | 'pending' | 'completed'
const INITIAL_SCHEDULE = [
  {
    id: 1, status: 'scheduled', date: '2026-04-29', day: 'Wed', production: true, client: 'Uniqlo SG', clientContactName: 'Sarah Chen',
    punctuality: 'red', timeStart: '9:00 AM', timeEnd: null,
    job: 'Roadshow booth bump-in — 6m × 4m, LED feature wall',
    location: 'Orchard ION B2 atrium',
    do: true, sales: 'Wei Ling', installers: [1, 2, 6],
    files: [{ id: 'f1', name: 'uniqlo-orchard-brief.pdf', section: 'Others' }],
    links: [],
    productionPhotos: [
      { id: 'p1', url: 'https://picsum.photos/seed/booth1/600/800', caption: 'LED wall test fit' },
      { id: 'p2', url: 'https://picsum.photos/seed/booth2/600/800', caption: 'Vinyl panels printed' },
      { id: 'p3', url: 'https://picsum.photos/seed/booth3/600/800', caption: '' },
    ],
    productionInstructions: 'Use 3M IJ180 vinyl for side panels. LED strips wired in series with 12V driver. Pre-test before shipping.',
    doPhoto: { url: 'https://picsum.photos/seed/do1/400/600', filename: 'signed-do-uniqlo.jpg' },
    completed: false,
    installerMessages: [
      { id: 'm-u-1', authorRole: 'sales', authorName: 'Wei Ling', ts: '2026-04-29T08:30:00', kind: 'text', text: 'Loading bay code is 4421. Goods lift on the right.' },
      { id: 'm-u-2', authorRole: 'installer', authorName: 'Aaron Tan', ts: '2026-04-29T09:12:00', kind: 'text', text: 'On site, starting setup. Lift was busy, gave us 20 min delay.' },
      { id: 'm-u-3', authorRole: 'installer', authorName: 'Aaron Tan', ts: '2026-04-29T09:14:00', kind: 'voice', voiceUrl: null, voiceDuration: 8, mock: true, text: '' },
    ],
  },
  {
    id: 2, status: 'scheduled', date: '2026-04-29', day: 'Wed', production: false, client: 'CDL Properties', clientContactName: 'Marcus Lee (project mgr)',
    punctuality: 'blue', timeStart: '10:30 AM', timeEnd: '5:00 PM',
    job: 'Hoarding panel install — 24m run, vinyl graphics',
    location: 'Tampines Ave 10 site',
    do: true, sales: 'Marcus', installers: [4, 3],
    files: [{ id: 'f2', name: 'cdl-tampines-ptw.pdf', section: 'PTW' }, { id: 'f3', name: 'hoarding-bca-drawings.pdf', section: 'BCA' }],
    links: [{ id: 'l1', label: 'Client artwork files', url: 'https://wetransfer.com/abc123', section: 'Others', addedAt: '2026-04-27T10:00:00', expiresAt: '2026-04-30T10:00:00' }],
    productionPhotos: [],
    productionInstructions: '',
    doPhoto: null,
    completed: false,
  },
  {
    id: 3, status: 'scheduled', date: '2026-04-30', day: 'Thu', production: true, client: 'DBS Bank', clientContactName: '',
    punctuality: 'red', timeStart: '8:00 PM', timeEnd: '11:30 PM',
    job: 'Marina Bay corp event booth — overnight bump-in',
    location: 'MBS Expo Hall B1',
    do: true, sales: 'Priya', installers: [1, 6, 5],
    files: [], links: [], productionPhotos: [], productionInstructions: '', doPhoto: null,
    completed: false,
  },
  {
    id: 4, status: 'scheduled', date: '2026-04-30', day: 'Thu', production: false, client: 'Watsons', clientContactName: 'Daphne Goh',
    punctuality: 'blue', timeStart: '11:00 AM', timeEnd: '3:00 PM',
    job: 'VM display refresh — 4 storefronts, vinyl swap',
    location: 'Plaza Singapura, Bugis+, VivoCity, JEM',
    do: false, sales: 'Jaslyn', installers: [2],
    files: [], links: [], productionPhotos: [], productionInstructions: '', doPhoto: null,
    completed: false,
  },
  // Pending enquiry — sales pencil-in to demo the clash flow
  {
    id: 50, status: 'pending', date: '2026-04-30', day: 'Thu', production: false, client: 'OCBC', clientContactName: '',
    punctuality: 'red', timeStart: '8:30 PM', timeEnd: '10:30 PM',
    job: 'Possible corporate event booth — awaiting client confirmation',
    location: 'MBS Expo Hall B2',
    do: false, sales: 'Priya', installers: [1, 5],
    files: [], links: [], productionPhotos: [], productionInstructions: '', doPhoto: null, completionPhotos: [],
    completed: false,
  },
  {
    id: 51, status: 'pending', date: '2026-05-03', day: 'Sun', production: false, client: '', clientContactName: '',
    punctuality: 'blue', timeStart: '10:00 AM', timeEnd: '4:00 PM',
    job: 'Enquiry — large format banner install, retail mall',
    location: 'TBC, central area',
    do: false, sales: 'Wei Ling', installers: [],
    files: [], links: [], productionPhotos: [], productionInstructions: '', doPhoto: null, completionPhotos: [],
    completed: false,
  },
  // Sales has sent this to scheduler — awaiting approval (demo for scheduler role)
  {
    id: 52, status: 'awaiting_approval', date: '2026-05-01', day: 'Fri', production: true, client: 'Capitaland', clientContactName: 'Joel Tay',
    punctuality: 'blue', timeStart: '9:00 AM', timeEnd: '6:00 PM',
    job: 'Mall popup — vinyl wrap + acrylic display cube, 3-day runway',
    location: 'Plaza Singapura atrium',
    do: false, sales: 'Marcus', installers: [3, 5],
    files: [], links: [], productionPhotos: [], productionInstructions: '', doPhoto: null, completionPhotos: [],
    completed: false,
    submittedForApprovalAt: '2026-04-28T14:20:00', submittedBy: 'Marcus',
  },
  // Pre-loaded completed job for demo
  {
    id: 100, status: 'completed', date: '2026-04-22', day: 'Wed', production: true, client: 'Shopee SG', clientContactName: 'Rachel Tan',
    punctuality: 'red', timeStart: '6:00 AM', timeEnd: '10:00 AM',
    job: 'Suntec Convention popup — completed last week',
    location: 'Suntec Hall 401',
    do: true, sales: 'Wei Ling', installers: [1, 2],
    files: [], links: [], productionPhotos: [], productionInstructions: '', doPhoto: null,
    completed: true, completedAt: '2026-04-22T10:30:00',
    installerMessages: [
      { id: 'm-s-1', authorRole: 'installer', authorName: 'Aaron Tan', ts: '2026-04-22T10:25:00', kind: 'text', text: 'Done. Site cleared. Client signed off.' },
    ],
  },
];

// Initial client contacts — keyed by client company, value is array of {name, phone}
const INITIAL_CLIENT_CONTACTS = {
  'Uniqlo SG': [
    { name: 'Sarah Chen', phone: '+65 9123 4567', role: 'Marketing' },
    { name: 'Tom Lim', phone: '+65 9876 5432', role: 'Procurement' },
  ],
  'CDL Properties': [
    { name: 'Marcus Lee (project mgr)', phone: '+65 9345 6789', role: 'Project Manager' },
  ],
  'DBS Bank': [],
  'Watsons': [
    { name: 'Daphne Goh', phone: '+65 8123 4567', role: 'Visual Merchandising' },
  ],
  'Shopee SG': [
    { name: 'Rachel Tan', phone: '+65 9234 1234', role: 'Events' },
  ],
};

// ============ HELPERS ============
const timeToMinutes = (t) => {
  if (!t) return null;
  const [time, ampm] = t.split(' ');
  let [h, m] = time.split(':').map(Number);
  if (ampm === 'PM' && h !== 12) h += 12;
  if (ampm === 'AM' && h === 12) h = 0;
  return h * 60 + m;
};

const detectClashes = (schedule, draft, ignoreId = null) => {
  const clashes = [];
  if (!draft.timeStart) return clashes;
  const draftStart = timeToMinutes(draft.timeStart);
  const draftEnd = draft.timeEnd ? timeToMinutes(draft.timeEnd) : draftStart + 60;

  schedule.forEach(job => {
    if (job.id === ignoreId || job.date !== draft.date) return;
    if (job.status === 'completed') return; // completed jobs don't clash
    const jobStart = timeToMinutes(job.timeStart);
    const jobEnd = job.timeEnd ? timeToMinutes(job.timeEnd) : jobStart + 60;
    const overlap = draftStart < jobEnd && draftEnd > jobStart;
    if (!overlap) return;

    const isPending = job.status === 'pending';
    const sharedInstallers = (draft.installers || []).filter(id => job.installers.includes(id));
    if (sharedInstallers.length > 0) {
      sharedInstallers.forEach(id => {
        const s = STAFF.find(s => s.id === id);
        clashes.push({
          type: 'installer',
          severity: isPending ? 'soft' : 'hard',
          installerId: id,
          conflictingJob: job,
          text: `${s.name} ${isPending ? 'pencilled in for' : 'also booked:'} ${job.client || 'pending enquiry'} ${job.timeStart}`
        });
      });
    }
    if (draft.client && draft.client === job.client && draft.id !== job.id) {
      clashes.push({
        type: 'client', severity: isPending ? 'soft' : 'hard', conflictingJob: job,
        text: `${job.client} ${isPending ? 'has another pending enquiry' : 'double-booked'} at ${job.timeStart}`
      });
    }
  });
  return clashes;
};

const proposeInstallers = (jobText) => {
  const text = jobText.toLowerCase();
  const scored = STAFF.filter(s => s.role.includes('Install')).map(s => {
    let score = 0;
    s.strengths.forEach(str => { if (text.includes(str.toLowerCase().split(' ')[0])) score += 3; });
    s.weaknesses.forEach(w => { if (text.includes(w.toLowerCase().split(' ')[0])) score -= 2; });
    score += s.exp * 0.2;
    return { ...s, score };
  });
  return scored.sort((a, b) => b.score - a.score).slice(0, 3);
};

// Build resolution data for a draft with hard clashes:
// - For each clashed installer, provide ranked substitutes free at that time
// - Provide whole-team alternative time slots as a fallback
const suggestAlternatives = (schedule, draft, ignoreId) => {
  const draftStart = timeToMinutes(draft.timeStart);
  const draftEnd = draft.timeEnd ? timeToMinutes(draft.timeEnd) : draftStart + 60;
  const sameDayJobs = schedule.filter(j =>
    j.id !== ignoreId && j.date === draft.date && j.status !== 'completed'
  );

  // Helper: which job is using this installer in our window?
  const findConflictForInstaller = (installerId) => {
    return sameDayJobs.find(j => {
      if (!j.installers.includes(installerId)) return false;
      const js = timeToMinutes(j.timeStart);
      const je = j.timeEnd ? timeToMinutes(j.timeEnd) : js + 60;
      return draftStart < je && draftEnd > js;
    });
  };

  // Helper: is a given installer free during the draft's range?
  const isFreeAt = (installerId, start, end) => {
    return !sameDayJobs.some(j => {
      if (!j.installers.includes(installerId)) return false;
      const js = timeToMinutes(j.timeStart);
      const je = j.timeEnd ? timeToMinutes(j.timeEnd) : js + 60;
      return start < je && end > js;
    });
  };

  // Score-rank installers by skill fit to job text
  const scoreInstaller = (s) => {
    const text = (draft.job || '').toLowerCase();
    let score = 0;
    s.strengths.forEach(str => { if (text.includes(str.toLowerCase().split(' ')[0])) score += 3; });
    s.weaknesses.forEach(w => { if (text.includes(w.toLowerCase().split(' ')[0])) score -= 2; });
    score += s.exp * 0.2;
    return score;
  };

  // For each clashed installer, build a list of substitutes
  const clashedInstallers = (draft.installers || [])
    .filter(id => findConflictForInstaller(id))
    .map(installerId => {
      const installer = STAFF.find(s => s.id === installerId);
      const conflict = findConflictForInstaller(installerId);
      const substitutes = STAFF
        .filter(s => s.role.includes('Install'))
        .filter(s => s.id !== installerId)
        .filter(s => !draft.installers.includes(s.id)) // not already on this job
        .filter(s => isFreeAt(s.id, draftStart, draftEnd))
        .map(s => ({ ...s, score: scoreInstaller(s) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 3);
      return { installer, conflict, substitutes };
    });

  // Whole-team alternative time slots
  const duration = draftEnd - draftStart;
  const altTimes = [];
  for (let m = 7 * 60; m <= 22 * 60 - duration; m += 30) {
    const allFree = (draft.installers || []).every(id => isFreeAt(id, m, m + duration));
    if (allFree) {
      const fmt = (mins) => {
        const h = Math.floor(mins / 60);
        const min = mins % 60;
        const ampm = h >= 12 ? 'PM' : 'AM';
        const dh = h > 12 ? h - 12 : (h === 0 ? 12 : h);
        return `${dh}:${String(min).padStart(2, '0')} ${ampm}`;
      };
      const startStr = fmt(m);
      const endStr = fmt(m + duration);
      if (startStr !== draft.timeStart) {
        altTimes.push({ timeStart: startStr, timeEnd: endStr });
      }
      if (altTimes.length >= 3) break;
    }
  }

  return { clashedInstallers, altTimes };
};

// Mock "now" for the prototype. In production this would be `new Date()`.
const MOCK_NOW = new Date('2026-04-29T15:30:00'); // Wed 29 Apr 2026, 3:30 PM
const MOCK_TODAY_STR = '2026-04-29';

// Detect overdue jobs that need a notification.
// Rule (from boss): a scheduled job needs completion photos to be marked done.
// If job has timeEnd → overdue when now > timeEnd and not completed.
// If timeEnd is unspecified → checkpoint every 2 hours after timeStart, plus a hard
// alert at 6 PM end-of-work-day.
const detectOverdue = (schedule) => {
  const alerts = [];
  const now = MOCK_NOW;
  const todayStr = MOCK_TODAY_STR;
  const nowMins = now.getHours() * 60 + now.getMinutes();
  const endOfDayMins = 18 * 60; // 6 PM

  schedule.forEach(job => {
    if (job.status !== 'scheduled' || job.completed) return;
    if (job.date !== todayStr) return; // only flag today's overdue for the prototype
    const start = timeToMinutes(job.timeStart);
    if (start === null || start > nowMins) return; // hasn't started yet

    const hasCompletionPhotos = (job.completionPhotos?.length || 0) > 0;
    let reason = null;
    let overdueMins = 0;

    if (job.timeEnd) {
      const end = timeToMinutes(job.timeEnd);
      if (nowMins > end) {
        reason = 'past_end';
        overdueMins = nowMins - end;
      }
    } else {
      // No end time — check 2-hour checkpoint
      const elapsed = nowMins - start;
      if (elapsed >= 120) {
        reason = 'checkpoint_2hr';
        overdueMins = elapsed - 120;
      }
      // Hard alert at end of day
      if (nowMins >= endOfDayMins) {
        reason = 'end_of_day';
        overdueMins = nowMins - endOfDayMins;
      }
    }

    if (reason) {
      alerts.push({
        id: `alert-${job.id}`,
        jobId: job.id,
        job,
        reason,
        overdueMins,
        hasPhotos: hasCompletionPhotos,
      });
    }
  });
  return alerts.sort((a, b) => b.overdueMins - a.overdueMins);
};

// Compute total job count + per-installer load for each date in a window.
// Returns: { byDate: { [date]: { total, jobs: [], byInstaller: {id: count} } } }
// Used by the workload preview popup so sales can see how busy each day is.
const dayLoadStats = (schedule, centerDate, windowDays = 14) => {
  const byDate = {};
  const start = new Date(centerDate);
  start.setDate(start.getDate() - Math.floor(windowDays / 2));
  for (let i = 0; i < windowDays; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const ds = d.toISOString().split('T')[0];
    byDate[ds] = { total: 0, jobs: [], byInstaller: {} };
  }
  schedule.forEach(job => {
    // Don't count completed or pending — only currently-active workload counts as "busy"
    if (job.status === 'completed' || job.status === 'pending') return;
    if (!byDate[job.date]) return;
    byDate[job.date].total += 1;
    byDate[job.date].jobs.push(job);
    (job.installers || []).forEach(id => {
      byDate[job.date].byInstaller[id] = (byDate[job.date].byInstaller[id] || 0) + 1;
    });
  });
  return byDate;
};

const fmtOverdue = (mins, t) => {
  if (mins < 60) return `${mins} ${t.mins}`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h} ${t.hr} ${m} ${t.mins}` : `${h} ${t.hr}`;
};

// Compact relative-time string for chat & dashboard timestamps (mock-now aware).
const fmtAgo = (iso, t, now = MOCK_NOW) => {
  if (!iso) return '';
  const ms = now.getTime() - new Date(iso).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 10) return t.jobChatJustNow;
  if (s < 60) return `${s}${t.jobChatSecondsAgo}`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} ${t.mins}`;
  const h = Math.floor(m / 60);
  if (h < 24) {
    const remM = m - h * 60;
    return remM > 0 ? `${h} ${t.hr} ${remM} ${t.mins}` : `${h} ${t.hr}`;
  }
  const d = Math.floor(h / 24);
  return `${d}d`;
};

// Pretty "starts in 2h 15m" / "started 30m ago" string for installer dashboard.
const fmtUntilJob = (job, t, now = MOCK_NOW) => {
  if (!job.timeStart) return null;
  const todayStr = MOCK_TODAY_STR;
  if (job.date !== todayStr) return null;
  const startMins = timeToMinutes(job.timeStart);
  const nowMins = now.getHours() * 60 + now.getMinutes();
  const diff = startMins - nowMins;
  if (diff > 0) return { kind: 'future', text: `${t.installerStartsIn} ${fmtOverdue(diff, t)}` };
  const endMins = job.timeEnd ? timeToMinutes(job.timeEnd) : null;
  if (endMins !== null && nowMins > endMins) {
    return { kind: 'overrun', text: `${t.installerOverrunning} · ${fmtOverdue(nowMins - endMins, t)}` };
  }
  return { kind: 'ongoing', text: `${t.installerStartedAgo} ${fmtOverdue(-diff, t)} ${t.installerAgo}` };
};

// ============ SHARED ============
const Card = ({ children, onClick, style }) => (
  <div onClick={onClick} style={{ background: C.card, borderRadius: 14, padding: 14, border: `1px solid ${C.line}`, cursor: onClick ? 'pointer' : 'default', ...style }}>
    {children}
  </div>
);

const Pill = ({ children, tone = 'neutral', style }) => {
  const tones = {
    neutral: { bg: C.line, fg: C.ink2 },
    good: { bg: C.goodBg, fg: C.good },
    warn: { bg: C.warnBg, fg: C.warn },
    bad: { bg: C.badBg, fg: C.bad },
    accent: { bg: C.accent2, fg: C.accent },
    red: { bg: '#FCE5E5', fg: C.red },
    blue: { bg: '#E5EEFC', fg: C.blue },
  };
  const t = tones[tone];
  return <span style={{ background: t.bg, color: t.fg, padding: '3px 9px', borderRadius: 999, fontSize: 11, fontFamily: F.body, fontWeight: 500, letterSpacing: '0.02em', ...style }}>{children}</span>;
};

const Btn = ({ children, onClick, variant = 'primary', icon: Icon, full, disabled, size = 'md' }) => {
  const styles = {
    primary: { bg: C.ink, fg: '#fff', border: C.ink },
    accent: { bg: C.accent, fg: '#fff', border: C.accent },
    ghost: { bg: 'transparent', fg: C.ink, border: C.line },
  };
  const s = styles[variant];
  const pad = size === 'sm' ? '8px 12px' : '11px 16px';
  return (
    <button onClick={onClick} disabled={disabled} style={{
      background: s.bg, color: s.fg, border: `1px solid ${s.border}`,
      padding: pad, borderRadius: 10, fontSize: size === 'sm' ? 13 : 14, fontWeight: 500,
      fontFamily: F.body, cursor: disabled ? 'not-allowed' : 'pointer',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7,
      width: full ? '100%' : 'auto', opacity: disabled ? 0.5 : 1,
    }}>
      {Icon && <Icon size={size === 'sm' ? 14 : 15} />}
      {children}
    </button>
  );
};

const SectionLabel = ({ children }) => (
  <div style={{ fontSize: 11, color: C.muted, fontFamily: F.body, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>{children}</div>
);

const Field = ({ label, children }) => (
  <div style={{ marginBottom: 12 }}>
    <div style={{ fontFamily: F.body, fontSize: 11, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>{label}</div>
    {children}
  </div>
);

const Input = ({ value, onChange, placeholder, type = 'text' }) => (
  <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
    style={{ width: '100%', padding: '10px 12px', border: `1px solid ${C.line}`, borderRadius: 8,
      fontFamily: F.body, fontSize: 14, color: C.ink, background: C.card, outline: 'none', boxSizing: 'border-box' }} />
);

const Select = ({ value, onChange, options, placeholder }) => (
  <select value={value || ''} onChange={e => onChange(e.target.value)}
    style={{ width: '100%', padding: '10px 12px', border: `1px solid ${C.line}`, borderRadius: 8,
      fontFamily: F.body, fontSize: 14, color: value ? C.ink : C.muted, background: C.card, outline: 'none' }}>
    <option value="">{placeholder}</option>
    {options.map(o => <option key={typeof o === 'string' ? o : o.value} value={typeof o === 'string' ? o : o.value}>{typeof o === 'string' ? o : o.label}</option>)}
  </select>
);

// Editable select - lets user pick from list, add new, or leave blank (= "Others")
const SelectAddable = ({ value, onChange, options, placeholder, addPrompt, t }) => {
  const [adding, setAdding] = useState(false);
  const [newVal, setNewVal] = useState('');

  if (adding) {
    return (
      <div style={{ display: 'flex', gap: 6 }}>
        <input
          autoFocus
          value={newVal}
          onChange={e => setNewVal(e.target.value)}
          placeholder={addPrompt}
          onKeyDown={e => {
            if (e.key === 'Enter' && newVal.trim()) { onChange(newVal.trim(), true); setAdding(false); setNewVal(''); }
            if (e.key === 'Escape') { setAdding(false); setNewVal(''); }
          }}
          style={{ flex: 1, padding: '10px 12px', border: `1px solid ${C.accent}`, borderRadius: 8,
            fontFamily: F.body, fontSize: 14, color: C.ink, background: C.card, outline: 'none', boxSizing: 'border-box' }}
        />
        <button
          onClick={() => { if (newVal.trim()) { onChange(newVal.trim(), true); setAdding(false); setNewVal(''); } }}
          style={{ padding: '0 14px', borderRadius: 8, border: 'none', background: C.accent, color: '#fff', fontFamily: F.body, fontSize: 13, cursor: 'pointer' }}>
          ✓
        </button>
        <button
          onClick={() => { setAdding(false); setNewVal(''); }}
          style={{ padding: '0 12px', borderRadius: 8, border: `1px solid ${C.line}`, background: C.card, color: C.muted, fontFamily: F.body, fontSize: 13, cursor: 'pointer' }}>
          ✕
        </button>
      </div>
    );
  }

  return (
    <select
      value={value || ''}
      onChange={e => {
        if (e.target.value === '__add__') { setAdding(true); }
        else { onChange(e.target.value, false); }
      }}
      style={{ width: '100%', padding: '10px 12px', border: `1px solid ${C.line}`, borderRadius: 8,
        fontFamily: F.body, fontSize: 14, color: value ? C.ink : C.muted, background: C.card, outline: 'none' }}>
      <option value="">{placeholder} ({t.otherBlank})</option>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
      <option value="__add__" style={{ color: C.accent, fontWeight: 600 }}>{t.addNew}</option>
    </select>
  );
};

// AI suggestion chip — appears when attachment uploaded, taps to fill field
const SuggestChip = ({ text, onUse, t }) => (
  <button
    onClick={onUse}
    style={{
      marginTop: 6, width: '100%', textAlign: 'left',
      padding: '8px 10px', background: C.accent2, border: `1px dashed ${C.accent}`, borderRadius: 8,
      fontFamily: F.body, fontSize: 12, color: C.ink2, cursor: 'pointer',
      display: 'flex', gap: 8, alignItems: 'flex-start',
    }}>
    <Sparkles size={12} color={C.accent} style={{ flexShrink: 0, marginTop: 2 }} />
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: 10, color: C.accent, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>
        {t.aiSuggested} · {t.tapToUse}
      </div>
      <div style={{ color: C.ink }}>{text}</div>
    </div>
  </button>
);

// ============ CONTACT PICKER ============
// Smart filter to pick a contact person tied to a client. Names are stored against
// the client company; phone is stored against the name.
const ContactPicker = ({ clientName, contacts, value, onChange, onAddContact, onUpdatePhone, onUpdateRole, t }) => {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const list = contacts || [];
  const filtered = query.trim()
    ? list.filter(c => c.name.toLowerCase().includes(query.toLowerCase()) || (c.role || '').toLowerCase().includes(query.toLowerCase()))
    : list;
  const exactMatch = filtered.some(c => c.name.toLowerCase() === query.trim().toLowerCase());
  const selected = list.find(c => c.name === value);

  const addNew = () => {
    const name = query.trim();
    if (!name) return;
    onAddContact({ name, phone: '', role: '' });
    onChange(name);
    setQuery('');
    setOpen(false);
  };

  return (
    <div>
      <div style={{ position: 'relative' }}>
        <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: C.muted, pointerEvents: 'none' }} />
        <input
          value={open ? query : (selected ? selected.name : '')}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => { setOpen(true); setQuery(selected?.name || ''); }}
          placeholder={t.searchOrAddPerson}
          style={{ width: '100%', padding: '10px 12px 10px 34px', border: `1px solid ${open ? C.accent : C.line}`, borderRadius: 8,
            fontFamily: F.body, fontSize: 14, color: C.ink, background: C.card, outline: 'none', boxSizing: 'border-box' }}
        />
        {selected && !open && (
          <button onClick={() => { onChange(''); setQuery(''); }} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: C.muted, padding: 4 }}>
            <X size={14} />
          </button>
        )}
      </div>

      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 30 }} />
          <div style={{
            position: 'relative', zIndex: 40, marginTop: 4, background: C.card,
            border: `1px solid ${C.line}`, borderRadius: 8, boxShadow: '0 6px 18px rgba(0,0,0,0.06)',
            maxHeight: 240, overflowY: 'auto'
          }}>
            {filtered.length > 0 ? (
              filtered.map(c => (
                <button key={c.name}
                  onClick={() => { onChange(c.name); setOpen(false); setQuery(''); }}
                  style={{ width: '100%', textAlign: 'left', padding: '10px 12px', background: value === c.name ? C.accent2 : 'transparent', border: 'none', borderBottom: `1px solid ${C.line}`, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontFamily: F.body, fontSize: 13, color: C.ink, fontWeight: 500 }}>{c.name}</div>
                    {c.role && <div style={{ fontFamily: F.body, fontSize: 11, color: C.muted }}>{c.role}</div>}
                  </div>
                  {c.phone && <span style={{ fontFamily: F.body, fontSize: 11, color: C.muted }}>{c.phone}</span>}
                </button>
              ))
            ) : null}
            {query.trim() && !exactMatch && (
              <button onClick={addNew} style={{ width: '100%', textAlign: 'left', padding: '10px 12px', background: 'transparent', border: 'none', cursor: 'pointer', color: C.accent, fontFamily: F.body, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Plus size={13} /> {t.addPersonAs}: <strong>"{query.trim()}"</strong>
              </button>
            )}
            {filtered.length === 0 && !query.trim() && (
              <div style={{ padding: 16, fontFamily: F.body, fontSize: 12, color: C.muted, textAlign: 'center' }}>
                {clientName ? `No contacts saved for ${clientName} yet — type a name to add.` : 'Pick a client first.'}
              </div>
            )}
          </div>
        </>
      )}

      {/* Phone + designation for the selected contact */}
      {selected && !open && (
        <>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 8 }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Phone size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: C.muted }} />
              <input
                type="tel"
                value={selected.phone || ''}
                onChange={e => onUpdatePhone(selected.name, e.target.value)}
                placeholder={t.clientPOCPlaceholder}
                style={{ width: '100%', padding: '10px 12px 10px 34px', border: `1px solid ${C.line}`, borderRadius: 8,
                  fontFamily: F.body, fontSize: 14, color: C.ink, background: C.card, outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
            {selected.phone && /^[\d\s+\-()]+$/.test(selected.phone) && (
              <a href={`tel:${selected.phone.replace(/\s/g, '')}`}
                style={{ padding: '10px 12px', background: C.goodBg, color: C.good, borderRadius: 8, textDecoration: 'none', fontFamily: F.body, fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <Phone size={13} />
              </a>
            )}
          </div>

          {/* Designation / role input */}
          <input
            value={selected.role || ''}
            onChange={e => onUpdateRole(selected.name, e.target.value)}
            placeholder={t.designationPlaceholder}
            style={{ width: '100%', padding: '8px 12px', border: `1px solid ${C.line}`, borderRadius: 8,
              fontFamily: F.body, fontSize: 12, color: C.ink2, background: C.card, outline: 'none', boxSizing: 'border-box', marginTop: 6, fontStyle: selected.role ? 'normal' : 'italic' }}
          />
        </>
      )}
    </div>
  );
};

// ============ PHOTO GALLERY (lightbox) ============
const PhotoGallery = ({ photos, startIndex = 0, onClose, t }) => {
  const [idx, setIdx] = useState(startIndex);
  const photo = photos[idx];

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') setIdx(i => (i + 1) % photos.length);
      if (e.key === 'ArrowLeft') setIdx(i => (i - 1 + photos.length) % photos.length);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [photos.length, onClose]);

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', zIndex: 200,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 16
    }}>
      <div style={{ position: 'absolute', top: 16, right: 16, display: 'flex', gap: 12, alignItems: 'center', zIndex: 10 }}>
        <span style={{ color: 'rgba(255,255,255,0.7)', fontFamily: F.body, fontSize: 13 }}>{idx + 1} {t.photoOf} {photos.length}</span>
        <button onClick={(e) => { e.stopPropagation(); onClose(); }} style={{ background: 'rgba(255,255,255,0.1)', color: '#fff', border: 'none', cursor: 'pointer', padding: 8, borderRadius: 999 }}>
          <X size={18} />
        </button>
      </div>

      {photos.length > 1 && (
        <>
          <button onClick={(e) => { e.stopPropagation(); setIdx(i => (i - 1 + photos.length) % photos.length); }}
            style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', background: 'rgba(255,255,255,0.1)', color: '#fff', border: 'none', cursor: 'pointer', padding: 12, borderRadius: 999, zIndex: 10 }}>
            <ChevronLeft size={20} />
          </button>
          <button onClick={(e) => { e.stopPropagation(); setIdx(i => (i + 1) % photos.length); }}
            style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', background: 'rgba(255,255,255,0.1)', color: '#fff', border: 'none', cursor: 'pointer', padding: 12, borderRadius: 999, zIndex: 10 }}>
            <ChevronRight size={20} />
          </button>
        </>
      )}

      <img src={photo.url} alt={photo.caption || ''} onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '95%', maxHeight: '85vh', objectFit: 'contain', borderRadius: 8 }} />

      {photo.caption && (
        <div onClick={(e) => e.stopPropagation()}
          style={{ marginTop: 14, padding: '8px 14px', background: 'rgba(255,255,255,0.08)', color: '#fff', borderRadius: 8, fontFamily: F.body, fontSize: 13, maxWidth: '95%', textAlign: 'center' }}>
          {photo.caption}
        </div>
      )}
    </div>
  );
};

// ============ SCHEDULE ROW ============
const ScheduleRow = ({ job, onClick, t, muted, isOverdue }) => {
  const installerNames = job.installers.map(id => STAFF.find(s => s.id === id)?.name.split(' ')[0]).join(', ');
  const attachCount = (job.files?.length || 0) + (job.links?.length || 0);
  const isAwaiting = job.status === 'awaiting_approval';
  const completionCount = job.completionPhotos?.length || 0;
  return (
    <Card onClick={onClick} style={{
      marginBottom: 8,
      opacity: muted ? 0.72 : ((job.status === 'pending' || isAwaiting) ? 0.9 : 1),
      borderStyle: (job.status === 'pending' || isAwaiting) ? 'dashed' : 'solid',
      borderColor: isOverdue ? C.bad : (isAwaiting ? C.accent : C.line),
      borderWidth: isOverdue || isAwaiting ? 1.5 : 1,
      background: isOverdue ? '#FFF7F5' : C.card,
    }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <div style={{ flexShrink: 0, width: 6, alignSelf: 'stretch', borderRadius: 3, background: job.punctuality === 'red' ? C.red : C.blue, marginTop: 2 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
            <span style={{ fontFamily: F.display, fontSize: 16, color: C.ink, letterSpacing: '-0.01em' }}>{job.client || (t ? t.otherBlank : 'Others')}</span>
            <span style={{ fontFamily: F.body, fontSize: 12, color: C.ink2, fontWeight: 500 }}>
              {job.timeStart}{job.timeEnd ? ` – ${job.timeEnd}` : ''}
            </span>
          </div>
          <div style={{ fontFamily: F.body, fontSize: 13, color: C.ink2, lineHeight: 1.45, marginBottom: 6 }}>{job.job}</div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', fontFamily: F.body, fontSize: 11, color: C.muted, flexWrap: 'wrap' }}>
            <span style={{ display: 'flex', gap: 4, alignItems: 'center' }}><MapPin size={11} />{job.location.length > 22 ? job.location.slice(0, 22) + '…' : job.location}</span>
            <span style={{ display: 'flex', gap: 4, alignItems: 'center' }}><User size={11} />{installerNames}</span>
            {job.production && <Pill tone="good">{t ? t.productionTick : 'Production ✓'}</Pill>}
            {job.do && <Pill>{t ? t.doTick : 'DO ✓'}</Pill>}
            {job.status === 'pending' && <Pill tone="accent">⏳ {t ? t.pendingPill : 'Pending'}</Pill>}
            {isAwaiting && <Pill tone="accent">📨 {t ? t.sentForApproval : 'Sent for approval'}</Pill>}
            {isOverdue && <Pill tone="bad">⚠ {t ? t.alertOverdue : 'Overdue'}</Pill>}
            {job.completed && <Pill tone="neutral">✓ {t ? t.completed : 'Done'}</Pill>}
            {completionCount > 0 && job.status !== 'completed' && <Pill tone="good">📸 {completionCount}</Pill>}
            {attachCount > 0 && <span style={{ display: 'flex', gap: 4, alignItems: 'center', color: C.accent }}><Paperclip size={11} />{attachCount}</span>}
          </div>
        </div>
      </div>
    </Card>
  );
};

// ============ SCHEDULE TAB ============
const ScheduleTab = ({ schedule, onJobClick, onNewJob, t, lang, viewMode, setViewMode, isCompletedView, isPendingView, isApprovalsView, overdueIds }) => {
  const [selectedDate, setSelectedDate] = useState(() => {
    if (schedule.length === 0) return new Date().toISOString().split('T')[0];
    return schedule[0].date;
  });
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all'); // all | today | week | upcoming
  const [showSearch, setShowSearch] = useState(false);

  const localeMap = { en: 'en-GB', zh: 'zh-CN', bn: 'bn-BD' };
  const dayShort = {
    en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    zh: ['日', '一', '二', '三', '四', '五', '六'],
    bn: ['রবি', 'সোম', 'মঙ্গল', 'বুধ', 'বৃহঃ', 'শুক্র', 'শনি'],
  };

  // Apply search + filter
  const todayStr = MOCK_TODAY_STR; // shared mock "today"
  const filtered = schedule.filter(j => {
    // filter
    if (filter === 'today' && j.date !== todayStr) return false;
    if (filter === 'week') {
      const d = new Date(j.date), today = new Date(todayStr);
      const diffDays = Math.floor((d - today) / (1000 * 60 * 60 * 24));
      if (diffDays < 0 || diffDays > 7) return false;
    }
    if (filter === 'upcoming' && new Date(j.date) < new Date(todayStr)) return false;

    // search
    if (query.trim()) {
      const q = query.toLowerCase();
      const installerNames = j.installers.map(id => STAFF.find(s => s.id === id)?.name || '').join(' ').toLowerCase();
      const haystack = `${j.client || ''} ${j.job || ''} ${j.location || ''} ${j.sales || ''} ${installerNames} ${j.clientContactName || ''}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  const dates = [...new Set(filtered.map(j => j.date))].sort();
  const dayJobs = viewMode === 'list' ? filtered.filter(j => j.date === selectedDate) : filtered;
  const dateObj = new Date(selectedDate);
  const dayName = dayShort[lang][dateObj.getDay()];

  // Group by date for week/month view
  const jobsByDate = filtered.reduce((acc, j) => {
    (acc[j.date] = acc[j.date] || []).push(j);
    return acc;
  }, {});

  // Build week grid (7 days from selected)
  const weekStart = new Date(selectedDate);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return d.toISOString().split('T')[0];
  });

  // Build month grid
  const monthStart = new Date(dateObj.getFullYear(), dateObj.getMonth(), 1);
  const monthDays = new Date(dateObj.getFullYear(), dateObj.getMonth() + 1, 0).getDate();
  const startWeekday = monthStart.getDay();
  const monthCells = [
    ...Array.from({ length: startWeekday }, () => null),
    ...Array.from({ length: monthDays }, (_, i) => {
      const d = new Date(dateObj.getFullYear(), dateObj.getMonth(), i + 1);
      return d.toISOString().split('T')[0];
    })
  ];

  return (
    <>
      <div style={{ padding: '20px 20px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: F.body, fontSize: 11, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
            {isCompletedView ? t.completedTab : isPendingView ? t.pendingSubtitle : isApprovalsView ? t.approvalsSubtitle : t.companySchedule}
          </div>
          <h1 style={{ margin: 0, fontFamily: F.display, fontSize: 26, fontWeight: 500, color: C.ink, letterSpacing: '-0.02em' }}>
            {viewMode === 'list' && `${dayName}, ${dateObj.toLocaleDateString(localeMap[lang] || 'en-GB', { day: 'numeric', month: 'short' })}`}
            {viewMode === 'week' && dateObj.toLocaleDateString(localeMap[lang] || 'en-GB', { month: 'long', year: 'numeric' })}
            {viewMode === 'month' && dateObj.toLocaleDateString(localeMap[lang] || 'en-GB', { month: 'long', year: 'numeric' })}
          </h1>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <button onClick={() => setShowSearch(s => !s)} style={{ background: showSearch ? C.ink : C.card, border: `1px solid ${showSearch ? C.ink : C.line}`, color: showSearch ? '#fff' : C.ink2, borderRadius: 8, padding: 8, cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
            <Search size={14} />
          </button>
          {!isCompletedView && <Btn icon={Plus} variant="accent" size="sm" onClick={onNewJob}>{t.new}</Btn>}
        </div>
      </div>

      {/* Search bar */}
      {showSearch && (
        <div style={{ padding: '0 20px 10px' }}>
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: C.muted }} />
            <input
              autoFocus
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder={t.searchJobs}
              style={{ width: '100%', padding: '10px 36px 10px 34px', border: `1px solid ${C.line}`, borderRadius: 999,
                fontFamily: F.body, fontSize: 13, color: C.ink, background: C.card, outline: 'none', boxSizing: 'border-box' }}
            />
            {query && (
              <button onClick={() => setQuery('')} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: C.muted }}>
                <X size={14} />
              </button>
            )}
          </div>
        </div>
      )}

      {/* View mode + filter chips */}
      <div style={{ padding: '0 20px 12px', display: 'flex', gap: 8, overflowX: 'auto', alignItems: 'center' }}>
        {/* View modes */}
        <div style={{ display: 'flex', background: C.card, border: `1px solid ${C.line}`, borderRadius: 8, padding: 2, flexShrink: 0 }}>
          {[
            { v: 'list', Icon: List, label: t.viewList },
            { v: 'week', Icon: CalendarDays, label: t.viewWeek },
            { v: 'month', Icon: Grid3x3, label: t.viewMonth },
          ].map(({ v, Icon, label }) => (
            <button key={v} onClick={() => setViewMode(v)} title={label} style={{
              padding: '6px 10px', borderRadius: 6, border: 'none',
              background: viewMode === v ? C.ink : 'transparent',
              color: viewMode === v ? '#fff' : C.muted,
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
              fontFamily: F.body, fontSize: 11
            }}>
              <Icon size={12} />
              {label}
            </button>
          ))}
        </div>

        {/* Date range filters */}
        {!isCompletedView && [
          { v: 'all', label: t.filterAll },
          { v: 'today', label: t.filterToday },
          { v: 'week', label: t.filterWeek },
          { v: 'upcoming', label: t.filterUpcoming },
        ].map(({ v, label }) => (
          <button key={v} onClick={() => setFilter(v)} style={{
            padding: '6px 12px', borderRadius: 999, border: `1px solid ${filter === v ? C.accent : C.line}`,
            background: filter === v ? C.accent2 : C.card, color: filter === v ? C.accent : C.ink2,
            fontFamily: F.body, fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0
          }}>{label}</button>
        ))}
      </div>

      {/* === LIST VIEW === */}
      {viewMode === 'list' && (
        <>
          {dates.length > 0 && (
            <div style={{ padding: '0 20px 12px', display: 'flex', gap: 6, overflowX: 'auto' }}>
              {dates.map(d => {
                const dt = new Date(d);
                const active = d === selectedDate;
                const count = jobsByDate[d]?.length || 0;
                return (
                  <button key={d} onClick={() => setSelectedDate(d)} style={{
                    padding: '8px 14px', borderRadius: 10, border: `1px solid ${active ? C.ink : C.line}`,
                    background: active ? C.ink : C.card, color: active ? '#fff' : C.ink2,
                    fontFamily: F.body, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, minWidth: 56, position: 'relative'
                  }}>
                    <span style={{ fontSize: 10, opacity: 0.7 }}>{dayShort[lang][dt.getDay()]}</span>
                    <span style={{ fontFamily: F.display, fontSize: 16, letterSpacing: '-0.01em' }}>{dt.getDate()}</span>
                    {count > 0 && <span style={{ position: 'absolute', top: 4, right: 4, width: 6, height: 6, borderRadius: '50%', background: active ? '#fff' : C.accent }} />}
                  </button>
                );
              })}
            </div>
          )}

          <div style={{ padding: '0 20px 24px' }}>
            {dayJobs.length === 0 ? (
              <Card style={{ textAlign: 'center', padding: 40, color: C.muted }}>
                {isCompletedView ? <Archive size={28} strokeWidth={1.2} style={{ marginBottom: 10, opacity: 0.5 }} /> : isPendingView ? <ClipboardList size={28} strokeWidth={1.2} style={{ marginBottom: 10, opacity: 0.5 }} /> : isApprovalsView ? <Inbox size={28} strokeWidth={1.2} style={{ marginBottom: 10, opacity: 0.5 }} /> : <Calendar size={28} strokeWidth={1.2} style={{ marginBottom: 10, opacity: 0.5 }} />}
                <div style={{ fontFamily: F.body, fontSize: 13 }}>{isCompletedView ? t.noCompleted : isPendingView ? t.noPending : isApprovalsView ? t.noApprovals : t.noJobs}</div>
              </Card>
            ) : (
              <>
                <div style={{ display: 'flex', gap: 14, marginBottom: 12, fontFamily: F.body, fontSize: 11, color: C.muted }}>
                  <span style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: C.red }} />{t.strictOnTime}
                  </span>
                  <span style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: C.blue }} />{t.flexibleWindow}
                  </span>
                </div>
                {dayJobs.map(job => <ScheduleRow key={job.id} job={job} onClick={() => onJobClick(job)} t={t} muted={isCompletedView} isOverdue={overdueIds?.includes(job.id)} />)}
              </>
            )}
          </div>
        </>
      )}

      {/* === WEEK VIEW === */}
      {viewMode === 'week' && (
        <div style={{ padding: '0 20px 24px' }}>
          {weekDays.map(d => {
            const jobs = jobsByDate[d] || [];
            const dt = new Date(d);
            const isToday = d === todayStr;
            return (
              <div key={d} style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
                  <span style={{ fontFamily: F.display, fontSize: 18, color: isToday ? C.accent : C.ink, letterSpacing: '-0.01em' }}>{dt.getDate()}</span>
                  <span style={{ fontFamily: F.body, fontSize: 12, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{dayShort[lang][dt.getDay()]}</span>
                  {isToday && <Pill tone="accent">today</Pill>}
                  {jobs.length > 0 && <span style={{ marginLeft: 'auto', fontFamily: F.body, fontSize: 11, color: C.muted }}>{jobs.length} {jobs.length === 1 ? 'job' : 'jobs'}</span>}
                </div>
                {jobs.length === 0 ? (
                  <div style={{ paddingLeft: 12, fontFamily: F.body, fontSize: 12, color: C.muted, fontStyle: 'italic' }}>—</div>
                ) : (
                  jobs.map(job => <ScheduleRow key={job.id} job={job} onClick={() => onJobClick(job)} t={t} muted={isCompletedView} isOverdue={overdueIds?.includes(job.id)} />)
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* === MONTH VIEW === */}
      {viewMode === 'month' && (
        <div style={{ padding: '0 20px 24px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 8 }}>
            {dayShort[lang].map((d, i) => (
              <div key={i} style={{ textAlign: 'center', fontFamily: F.body, fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em', padding: 4 }}>{d}</div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
            {monthCells.map((d, i) => {
              if (!d) return <div key={i} />;
              const dt = new Date(d);
              const jobs = jobsByDate[d] || [];
              const isToday = d === todayStr;
              const isSelected = d === selectedDate;
              return (
                <button key={i} onClick={() => { setSelectedDate(d); setViewMode('list'); }}
                  style={{
                    aspectRatio: '1', border: `1px solid ${isSelected ? C.ink : C.line}`, borderRadius: 6,
                    background: isSelected ? C.ink : C.card, color: isSelected ? '#fff' : isToday ? C.accent : C.ink2,
                    cursor: 'pointer', padding: 4,
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start',
                    fontFamily: F.body, fontSize: 13, position: 'relative', minHeight: 38
                  }}>
                  <span style={{ fontWeight: isToday ? 600 : 400, fontSize: 13 }}>{dt.getDate()}</span>
                  {jobs.length > 0 && (
                    <div style={{ display: 'flex', gap: 2, marginTop: 2 }}>
                      {jobs.slice(0, 3).map((j, idx) => (
                        <span key={idx} style={{ width: 4, height: 4, borderRadius: '50%', background: isSelected ? '#fff' : (j.punctuality === 'red' ? C.red : C.blue) }} />
                      ))}
                      {jobs.length > 3 && <span style={{ fontSize: 8, color: isSelected ? '#fff' : C.muted, marginLeft: 1 }}>+</span>}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
          <div style={{ marginTop: 12, fontFamily: F.body, fontSize: 11, color: C.muted, textAlign: 'center' }}>
            Tap any date to see jobs in list view
          </div>
        </div>
      )}
    </>
  );
};

// ============ AI SMART TEXTAREA ============
// Used for Job description + Production instructions.
// Modes: "suggest" when empty AND attachments present → drafts from files
//        "improve" when text present → polishes language without changing intent
const AISmartTextarea = ({ value, onChange, placeholder, rows = 3, t, hasAttachments, suggestionWhenEmpty, improvementForText, disabled }) => {
  const [busy, setBusy] = useState(false);
  const [busyMode, setBusyMode] = useState(null); // 'suggest' | 'improve'
  const [suggestion, setSuggestion] = useState(null); // { mode, text }

  const trimmed = (value || '').trim();
  const canSuggest = !trimmed && hasAttachments;
  const canImprove = trimmed.length > 0;
  const mode = canImprove ? 'improve' : (canSuggest ? 'suggest' : null);

  const runAction = () => {
    if (!mode || disabled) return;
    setBusy(true);
    setBusyMode(mode);
    setSuggestion(null);
    setTimeout(() => {
      setBusy(false);
      setBusyMode(null);
      if (mode === 'suggest') {
        setSuggestion({ mode: 'suggest', text: suggestionWhenEmpty });
      } else {
        // Pretend Claude polished the text. Mock improvement: capitalises, joins, trims fluff.
        setSuggestion({ mode: 'improve', text: improvementForText(trimmed) });
      }
    }, 1200);
  };

  return (
    <div>
      <div style={{ position: 'relative' }}>
        <textarea
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          rows={rows}
          style={{ width: '100%', padding: '12px 12px 12px 12px', paddingRight: mode ? 86 : 12,
            border: `1px solid ${C.line}`, borderRadius: 8,
            fontFamily: F.body, fontSize: 14, color: C.ink, resize: 'vertical', outline: 'none', boxSizing: 'border-box',
            background: disabled ? C.bg : C.card }}
        />
        {mode && !disabled && (
          <button
            onClick={runAction}
            disabled={busy}
            style={{
              position: 'absolute', top: 8, right: 8, zIndex: 5,
              background: busy ? C.line : C.accent2, color: busy ? C.muted : C.accent,
              border: `1px solid ${C.accent}33`, borderRadius: 999,
              padding: '4px 10px', cursor: busy ? 'wait' : 'pointer',
              fontFamily: F.body, fontSize: 11, display: 'flex', alignItems: 'center', gap: 4
            }}>
            {busy ? <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} /> : <Sparkles size={11} />}
            {busy ? '…' : (mode === 'suggest' ? t.aiSuggest : t.aiImprove)}
          </button>
        )}
      </div>

      {busy && (
        <div style={{ marginTop: 6, padding: '6px 10px', fontFamily: F.body, fontSize: 11, color: C.muted, fontStyle: 'italic' }}>
          {busyMode === 'suggest' ? t.aiSuggesting : t.aiImproving}
        </div>
      )}

      {suggestion && (
        <div style={{ marginTop: 8, background: C.accent2, border: `1px dashed ${C.accent}`, borderRadius: 8, padding: 10 }}>
          <div style={{ fontFamily: F.body, fontSize: 10, color: C.accent, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
            <Sparkles size={11} /> {suggestion.mode === 'improve' ? t.aiImprove : t.aiSuggest}
          </div>
          {suggestion.mode === 'improve' && (
            <div style={{ marginBottom: 8, paddingBottom: 8, borderBottom: `1px solid ${C.accent}33` }}>
              <div style={{ fontFamily: F.body, fontSize: 10, color: C.muted, marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t.aiOriginal}</div>
              <div style={{ fontFamily: F.body, fontSize: 12, color: C.muted, lineHeight: 1.5 }}>{trimmed}</div>
            </div>
          )}
          <div style={{ fontFamily: F.body, fontSize: 10, color: C.accent, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t.aiSuggested2}</div>
          <div style={{ fontFamily: F.body, fontSize: 13, color: C.ink, lineHeight: 1.55, marginBottom: 10 }}>{suggestion.text}</div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => setSuggestion(null)}
              style={{ flex: 1, padding: '7px 10px', borderRadius: 6, border: `1px solid ${C.line}`, background: C.card, color: C.ink2, fontFamily: F.body, fontSize: 12, cursor: 'pointer' }}>
              {t.aiKeep}
            </button>
            <button onClick={() => { onChange(suggestion.text); setSuggestion(null); }}
              style={{ flex: 1, padding: '7px 10px', borderRadius: 6, border: 'none', background: C.accent, color: '#fff', fontFamily: F.body, fontSize: 12, cursor: 'pointer' }}>
              {t.aiAccept}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ============ LINK EXPIRY HELPERS ============
const expiryStatus = (link, t) => {
  if (!link.expiresAt) return null;
  const now = MOCK_NOW; // mock "today" for prototype, shared with overdue detection
  const exp = new Date(link.expiresAt);
  const ms = exp - now;
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  const hours = Math.floor(ms / (1000 * 60 * 60));
  if (ms < 0) return { tone: 'bad', label: t.expired, urgent: true };
  if (hours < 24) return { tone: 'bad', label: t.expiryToday, urgent: true };
  if (hours < 48) return { tone: 'warn', label: t.expiryTomorrow, urgent: true };
  if (days < 7) return { tone: 'warn', label: `${t.expiresInDays} ${days} ${t.days}`, urgent: false };
  return { tone: 'neutral', label: `${t.expiresInDays} ${days} ${t.days}`, urgent: false };
};

const formatAddedDate = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
};

// Mock "improve" — in real app this calls Claude with: "Polish this for clarity, keep meaning."
// Here it does some simple cleanup so the demo feels real.
const mockImprove = (text) => {
  if (!text) return text;
  let t = text.trim();
  // Common typo / phrasing fixes for demo
  t = t.replace(/\s+/g, ' ');
  t = t.replace(/\bi\b/g, 'I');
  t = t.replace(/\bdun\b/gi, 'do not');
  t = t.replace(/\bcan u\b/gi, 'can you');
  t = t.replace(/\bpls\b/gi, 'please');
  t = t.replace(/\bplz\b/gi, 'please');
  t = t.replace(/\btmr\b/gi, 'tomorrow');
  t = t.replace(/\bmust install\b/gi, 'install');
  t = t.replace(/\bbring tools\b/gi, 'bring all required tools');
  if (t && !/[.!?]$/.test(t)) t += '.';
  if (t.length > 0) t = t[0].toUpperCase() + t.slice(1);
  // Add a structural hint if user wrote something very short
  if (t.length < 40) {
    t = t.replace(/\.$/, '');
    t += ' — confirm scope, materials, and access requirements with site contact before bump-in.';
  }
  return t;
};

// ============ CLASH RESOLVER MODAL ============
// Per-installer clash resolution — for each clashed installer, user picks a substitute
// or chooses to keep them (will save anyway). At bottom there's also a whole-team time-shift fallback.
const ClashResolverModal = ({ popup, t, onClose, onProceed }) => {
  const { draft, suggestions } = popup;
  // resolutions: { [installerId]: 'keep' | <substituteId> | null }
  const initialResolutions = {};
  suggestions.clashedInstallers.forEach(c => { initialResolutions[c.installer.id] = null; });
  const [resolutions, setResolutions] = useState(initialResolutions);

  const setResolution = (installerId, decision) => {
    setResolutions(r => ({ ...r, [installerId]: decision }));
  };

  const unresolved = suggestions.clashedInstallers.filter(c => resolutions[c.installer.id] === null).length;
  const allResolved = unresolved === 0;
  const anyKept = Object.values(resolutions).some(v => v === 'keep');

  // Build the modified draft applying all swap decisions
  const buildModifiedDraft = () => {
    const newInstallers = (draft.installers || []).map(id => {
      const decision = resolutions[id];
      if (!decision || decision === 'keep') return id; // keep original
      return decision; // it's a substitute id
    });
    return { ...draft, installers: newInstallers };
  };

  const applyTimeShift = (timeStart, timeEnd) => {
    onProceed({ ...draft, timeStart, timeEnd });
  };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: C.card, borderRadius: 16, padding: 18, maxWidth: 460, width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <div style={{ width: 30, height: 30, borderRadius: '50%', background: C.warnBg, color: C.warn, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Lightbulb size={15} />
          </div>
          <div style={{ fontFamily: F.display, fontSize: 17, color: C.ink, letterSpacing: '-0.01em' }}>
            {suggestions.clashedInstallers.length} {t.clashesNeedResolving}
          </div>
        </div>
        <div style={{ fontFamily: F.body, fontSize: 12, color: C.muted, marginBottom: 14 }}>
          {draft.date} · {draft.timeStart}{draft.timeEnd ? ` – ${draft.timeEnd}` : ''}
        </div>

        {/* Per-clash resolver cards */}
        {suggestions.clashedInstallers.map(c => {
          const installer = c.installer;
          const conflict = c.conflict;
          const decision = resolutions[installer.id];
          const isKept = decision === 'keep';
          const chosenSub = decision && decision !== 'keep' ? STAFF.find(s => s.id === decision) : null;

          return (
            <div key={installer.id} style={{
              marginBottom: 12, padding: 12,
              background: decision ? (isKept ? C.warnBg : C.goodBg) : C.bg,
              border: `1px solid ${decision ? (isKept ? C.warn + '55' : C.good + '55') : C.line}`,
              borderRadius: 10
            }}>
              {/* Clash statement */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 10 }}>
                <AlertCircle size={14} color={isKept ? C.warn : C.bad} style={{ flexShrink: 0, marginTop: 2 }} />
                <div style={{ flex: 1, fontFamily: F.body, fontSize: 13, color: C.ink, lineHeight: 1.45 }}>
                  <strong>{installer.name}</strong> {t.clashedInstaller} — {t.bookedAt} <strong>{conflict.client || 'pending enquiry'}</strong> ({conflict.timeStart}{conflict.timeEnd ? `–${conflict.timeEnd}` : ''}).
                </div>
              </div>

              {/* Resolution shown if decision made */}
              {decision && (
                <div style={{ marginBottom: 10, padding: '8px 10px', background: C.card, borderRadius: 6, fontFamily: F.body, fontSize: 12, color: C.ink2, display: 'flex', alignItems: 'center', gap: 6 }}>
                  {isKept ? (
                    <><AlertCircle size={12} color={C.warn} /> {t.keptClashed}</>
                  ) : (
                    <><Check size={12} color={C.good} /> {t.resolvedSwap} <strong style={{ color: C.ink }}>{chosenSub.name}</strong></>
                  )}
                  <button onClick={() => setResolution(installer.id, null)}
                    style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: C.muted, fontFamily: F.body, fontSize: 11, textDecoration: 'underline' }}>
                    change
                  </button>
                </div>
              )}

              {/* Substitute picker — only show if no decision yet */}
              {!decision && (
                <>
                  <div style={{ fontFamily: F.body, fontSize: 11, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
                    {t.chooseSubstitute}
                  </div>
                  {c.substitutes.length === 0 ? (
                    <div style={{ fontFamily: F.body, fontSize: 12, color: C.muted, fontStyle: 'italic', padding: '4px 0 8px' }}>{t.noAltInstallers}</div>
                  ) : (
                    c.substitutes.map(s => (
                      <button key={s.id} onClick={() => setResolution(installer.id, s.id)}
                        style={{
                          width: '100%', textAlign: 'left',
                          display: 'flex', alignItems: 'center', gap: 10,
                          padding: '8px 10px', background: C.card, border: `1px solid ${C.line}`,
                          borderRadius: 6, marginBottom: 5, cursor: 'pointer'
                        }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontFamily: F.body, fontSize: 13, color: C.ink, fontWeight: 500 }}>{t.replaceWith}: {s.name}</div>
                          <div style={{ fontFamily: F.body, fontSize: 11, color: C.muted }}>{s.role} · {s.exp}y · {s.strengths.slice(0, 2).join(', ')}</div>
                        </div>
                        <ChevronRight size={14} color={C.muted} />
                      </button>
                    ))
                  )}
                  <button onClick={() => setResolution(installer.id, 'keep')}
                    style={{
                      width: '100%', textAlign: 'left',
                      padding: '8px 10px', background: 'transparent', border: `1px dashed ${C.line}`,
                      borderRadius: 6, marginTop: 4, cursor: 'pointer',
                      fontFamily: F.body, fontSize: 12, color: C.muted
                    }}>
                    {t.keepClashed} ({installer.name})
                  </button>
                </>
              )}
            </div>
          );
        })}

        {/* Whole-team time shift fallback */}
        {suggestions.altTimes.length > 0 && (
          <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px dashed ${C.line}` }}>
            <div style={{ fontFamily: F.body, fontSize: 11, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
              {t.orShiftWholeTeam}
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {suggestions.altTimes.map((tm, i) => (
                <button key={i} onClick={() => applyTimeShift(tm.timeStart, tm.timeEnd)}
                  style={{
                    padding: '6px 10px', borderRadius: 999,
                    border: `1px solid ${C.accent}`, background: C.card, color: C.accent,
                    fontFamily: F.body, fontSize: 11, cursor: 'pointer',
                    display: 'inline-flex', alignItems: 'center', gap: 4
                  }}>
                  <Clock size={11} />
                  {tm.timeStart}{tm.timeEnd ? ` – ${tm.timeEnd}` : ''}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Footer actions */}
        <div style={{ marginTop: 18, paddingTop: 14, borderTop: `1px solid ${C.line}` }}>
          {!allResolved && (
            <div style={{ fontFamily: F.body, fontSize: 11, color: C.warn, marginBottom: 8, textAlign: 'center' }}>
              {unresolved} {t.unresolvedClashes}
            </div>
          )}
          {allResolved && !anyKept && (
            <div style={{ fontFamily: F.body, fontSize: 11, color: C.good, marginBottom: 8, textAlign: 'center' }}>
              ✓ {t.allClashesResolved}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn variant="ghost" full onClick={onClose}>{t.cancelSave}</Btn>
            <Btn
              variant="accent"
              full
              icon={popup.action === 'send_to_scheduler' ? Send : (popup.action === 'approve' ? ShieldCheck : (popup.action === 'push' ? Send : Check))}
              disabled={!allResolved}
              onClick={() => onProceed(buildModifiedDraft())}
            >
              {popup.action === 'send_to_scheduler' ? t.sendToScheduler : (popup.action === 'approve' ? t.approveAndSchedule : (popup.action === 'push' ? t.applyAndPush : t.applyAndSave))}
            </Btn>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============ VOICE NOTE — RECORDER & PLAYBACK BUBBLE ============
// Real MediaRecorder when permissions allow; falls back gracefully to a mock entry
// (still shows duration + waveform UI) when mic is unavailable. Saves a blob URL we
// can play in <audio> after success.
const VoiceRecorder = ({ onSave, t, disabled }) => {
  const [recording, setRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState('');
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const startedAtRef = useRef(0);
  const tickRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => () => {
    if (tickRef.current) clearInterval(tickRef.current);
    if (streamRef.current) streamRef.current.getTracks().forEach(tr => tr.stop());
  }, []);

  const start = async () => {
    if (disabled) return;
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: chunksRef.current[0]?.type || 'audio/webm' });
        const url = URL.createObjectURL(blob);
        const dur = Math.max(1, Math.floor((Date.now() - startedAtRef.current) / 1000));
        onSave({ voiceUrl: url, voiceDuration: dur, mock: false });
        if (streamRef.current) streamRef.current.getTracks().forEach(tr => tr.stop());
        streamRef.current = null;
      };
      mr.start();
      recorderRef.current = mr;
      startedAtRef.current = Date.now();
      setRecording(true);
      setDuration(0);
      tickRef.current = setInterval(() => {
        setDuration(Math.floor((Date.now() - startedAtRef.current) / 1000));
      }, 250);
    } catch (e) {
      // Mock fallback — save a placeholder voice note
      setError(t.jobChatVoiceFallback);
      onSave({ voiceUrl: null, voiceDuration: 4, mock: true });
      setTimeout(() => setError(''), 2400);
    }
  };

  const stop = () => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
    }
    if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
    setRecording(false);
  };

  if (recording) {
    return (
      <button onClick={stop} style={{
        background: C.bad, color: '#fff', border: 'none', borderRadius: 999,
        padding: '7px 12px', display: 'inline-flex', alignItems: 'center', gap: 6,
        fontFamily: F.body, fontSize: 12, cursor: 'pointer', flexShrink: 0,
      }}>
        <span style={{ width: 8, height: 8, background: '#fff', borderRadius: '50%', animation: 'pulse 1.2s ease-in-out infinite' }} />
        <Square size={11} fill="#fff" />
        <span>{Math.floor(duration / 60)}:{String(duration % 60).padStart(2, '0')}</span>
        <span style={{ opacity: 0.85, fontSize: 10 }}>· {t.jobChatRecordingTap}</span>
      </button>
    );
  }
  return (
    <>
      <button onClick={start} disabled={disabled} style={{
        background: C.card, color: C.ink2, border: `1px solid ${C.line}`, borderRadius: 999,
        padding: '7px 12px', display: 'inline-flex', alignItems: 'center', gap: 6,
        fontFamily: F.body, fontSize: 12, cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1, flexShrink: 0,
      }}>
        <Mic size={12} /> {t.jobChatRecordVoice}
      </button>
      {error && <span style={{ fontFamily: F.body, fontSize: 10, color: C.warn, marginLeft: 6 }}>{error}</span>}
    </>
  );
};

// Voice-note playback bubble — animates fake waveform while playing.
// Falls back to "demo" mode (no real audio) when blob URL is null (mock recording).
const VoiceBubble = ({ url, duration, mock, t, fg }) => {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0); // 0..1
  const audioRef = useRef(null);
  const tickRef = useRef(null);
  const startRef = useRef(0);

  useEffect(() => () => {
    if (tickRef.current) clearInterval(tickRef.current);
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
  }, []);

  // Generate a deterministic waveform pattern from duration+url
  const bars = Array.from({ length: 22 }, (_, i) => {
    const seed = (duration * 13 + i * 7 + (url ? url.length : 31)) % 100;
    return 6 + (seed / 100) * 18;
  });

  const startTick = () => {
    startRef.current = Date.now();
    tickRef.current = setInterval(() => {
      const p = Math.min(1, (Date.now() - startRef.current) / (duration * 1000));
      setProgress(p);
      if (p >= 1) {
        clearInterval(tickRef.current);
        tickRef.current = null;
        setPlaying(false);
        setTimeout(() => setProgress(0), 200);
      }
    }, 80);
  };

  const toggle = () => {
    if (playing) {
      // Pause
      if (audioRef.current) audioRef.current.pause();
      if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
      setPlaying(false);
      return;
    }
    // Play
    if (url) {
      if (!audioRef.current) {
        const a = new Audio(url);
        a.onended = () => {
          setPlaying(false);
          if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
          setTimeout(() => setProgress(0), 200);
        };
        audioRef.current = a;
      }
      audioRef.current.play().catch(() => {});
    }
    setPlaying(true);
    startTick();
  };

  const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  const accentCol = fg || C.accent;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 4px', minWidth: 200 }}>
      <button onClick={toggle} style={{
        width: 34, height: 34, borderRadius: '50%', border: 'none', background: accentCol,
        color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        {playing ? <Pause size={14} fill="#fff" /> : <Play size={14} fill="#fff" style={{ marginLeft: 2 }} />}
      </button>
      <div style={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1, height: 28 }}>
        {bars.map((h, i) => {
          const filled = i / bars.length <= progress;
          return (
            <span key={i} style={{
              width: 3, height: h,
              background: filled ? accentCol : `${accentCol}55`,
              borderRadius: 2,
              transition: 'background 160ms',
            }} />
          );
        })}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', minWidth: 38 }}>
        <span style={{ fontFamily: F.body, fontSize: 11, color: accentCol, fontWeight: 500 }}>
          {fmt(playing ? Math.floor(progress * duration) : duration)}
        </span>
        {mock && <span style={{ fontFamily: F.body, fontSize: 9, color: C.muted }}>demo</span>}
      </div>
    </div>
  );
};

// ============ JOB CHAT THREAD ============
// Live chat thread embedded in JobDetail and InstallerJobView. All roles see + post.
// Sync indicator pulses every 3s to convey live updates (data is React state so updates
// are instant — the indicator is for UX). Voice notes use MediaRecorder with mock fallback.
const JobChatThread = ({ job, schedule, setSchedule, currentUser, t, onInstallerActivity }) => {
  const [text, setText] = useState('');
  const [tick, setTick] = useState(0); // forces "synced Xs ago" label refresh
  const [lastSyncTs, setLastSyncTs] = useState(Date.now());
  const scrollRef = useRef(null);

  // Pull live messages directly from schedule state — this re-renders whenever a new
  // message arrives via setSchedule (e.g. from a different role / view).
  const liveJob = schedule.find(j => j.id === job.id) || job;
  const messages = liveJob.installerMessages || [];

  // 1s ticker for "synced Xs ago" label
  useEffect(() => {
    const id = setInterval(() => setTick(n => n + 1), 1000);
    return () => clearInterval(id);
  }, []);
  // 3s "sync pulse" — visually re-anchors the synced timestamp to feel live
  useEffect(() => {
    const id = setInterval(() => setLastSyncTs(Date.now()), 3000);
    return () => clearInterval(id);
  }, []);

  // Auto-scroll to bottom on new message
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages.length]);

  const appendMessage = (payload) => {
    const msg = {
      id: `m${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      authorRole: currentUser.role,
      authorName: currentUser.name,
      ts: new Date().toISOString(),
      ...payload,
    };
    setSchedule(s => s.map(j => j.id === job.id
      ? { ...j, installerMessages: [...(j.installerMessages || []), msg] }
      : j
    ));
    if (currentUser.role === 'installer' && onInstallerActivity) {
      onInstallerActivity({
        kind: payload.kind === 'voice' ? 'voice' : 'comment',
        salesPOC: liveJob.sales,
      });
    }
  };

  const sendText = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    appendMessage({ kind: 'text', text: trimmed });
    setText('');
  };

  const handleVoiceSave = ({ voiceUrl, voiceDuration, mock }) => {
    appendMessage({ kind: 'voice', voiceUrl, voiceDuration, mock, text: '' });
  };

  // Sync label
  const secondsSinceSync = Math.floor((Date.now() - lastSyncTs) / 1000);
  void tick; // tick triggers re-render; we use Date.now directly above

  const roleLabel = (r) => {
    if (r === 'sales') return t.jobChatSalesRole;
    if (r === 'scheduler') return t.jobChatSchedulerRole;
    return t.jobChatInstallerRole;
  };
  const roleAccent = (r) => {
    if (r === 'sales') return C.blue;
    if (r === 'scheduler') return C.accent;
    return C.good;
  };

  return (
    <Card style={{ marginTop: 12, padding: 0, overflow: 'hidden' }}>
      {/* Header with live indicator */}
      <div style={{
        padding: '12px 14px', borderBottom: `1px solid ${C.line}`, background: C.bg,
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <MessageCircle size={14} color={C.accent} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: F.body, fontSize: 11, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            {t.jobChatTitle}
          </div>
          <div style={{ fontFamily: F.body, fontSize: 11, color: C.ink2, marginTop: 1 }}>
            {t.jobChatSubtitle}
          </div>
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 5,
          padding: '4px 8px', borderRadius: 999,
          background: C.goodBg, color: C.good,
          fontFamily: F.body, fontSize: 10, fontWeight: 500,
        }}>
          <span style={{
            width: 6, height: 6, borderRadius: '50%', background: C.good,
            animation: 'pulse 1.6s ease-in-out infinite',
          }} />
          {t.jobChatLive}
          <span style={{ color: C.muted, fontWeight: 400, marginLeft: 2 }}>
            · {secondsSinceSync < 1 ? t.jobChatJustNow : `${secondsSinceSync}${t.jobChatSecondsAgo}`}
          </span>
        </div>
      </div>

      {/* Messages list */}
      <div ref={scrollRef} style={{
        maxHeight: 320, overflowY: 'auto', padding: '12px 14px',
        background: C.card, display: 'flex', flexDirection: 'column', gap: 10,
      }}>
        {messages.length === 0 && (
          <div style={{
            fontFamily: F.body, fontSize: 12, color: C.muted, textAlign: 'center',
            padding: '20px 12px', fontStyle: 'italic',
          }}>
            {t.jobChatNoMessages}
          </div>
        )}
        {messages.map((m) => {
          const mine = m.authorName === currentUser.name && m.authorRole === currentUser.role;
          const accentCol = roleAccent(m.authorRole);
          return (
            <div key={m.id} style={{
              display: 'flex', flexDirection: 'column',
              alignItems: mine ? 'flex-end' : 'flex-start',
              gap: 3,
            }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, padding: '0 4px' }}>
                <span style={{
                  fontFamily: F.body, fontSize: 11, fontWeight: 500,
                  color: mine ? C.ink : accentCol,
                }}>
                  {mine ? t.jobChatYou : m.authorName}
                </span>
                <span style={{
                  fontFamily: F.body, fontSize: 9, color: accentCol,
                  textTransform: 'uppercase', letterSpacing: '0.08em',
                }}>
                  {roleLabel(m.authorRole)}
                </span>
                <span style={{ fontFamily: F.body, fontSize: 10, color: C.muted }}>
                  · {fmtAgo(m.ts, t)}
                </span>
              </div>
              <div style={{
                maxWidth: '85%',
                padding: m.kind === 'voice' ? '6px 10px' : '8px 12px',
                borderRadius: 12,
                background: mine ? C.ink : (m.authorRole === 'installer' ? C.goodBg : (m.authorRole === 'sales' ? '#E5EEFC' : C.accent2)),
                color: mine ? '#fff' : C.ink,
                fontFamily: F.body, fontSize: 13, lineHeight: 1.45,
                wordBreak: 'break-word',
              }}>
                {m.kind === 'voice' ? (
                  <VoiceBubble
                    url={m.voiceUrl}
                    duration={m.voiceDuration || 1}
                    mock={m.mock}
                    t={t}
                    fg={mine ? '#fff' : accentCol}
                  />
                ) : (
                  m.text
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Composer */}
      <div style={{
        padding: '10px 12px', borderTop: `1px solid ${C.line}`, background: C.bg,
        display: 'flex', flexDirection: 'column', gap: 8,
      }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendText(); } }}
            placeholder={t.jobChatPlaceholder}
            style={{
              flex: 1, padding: '9px 12px', border: `1px solid ${C.line}`, borderRadius: 999,
              fontFamily: F.body, fontSize: 13, color: C.ink, background: C.card, outline: 'none',
            }}
          />
          <button onClick={sendText} disabled={!text.trim()} style={{
            background: text.trim() ? C.accent : C.line, color: text.trim() ? '#fff' : C.muted,
            border: 'none', borderRadius: '50%', width: 36, height: 36, cursor: text.trim() ? 'pointer' : 'not-allowed',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <Send size={14} />
          </button>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <VoiceRecorder onSave={handleVoiceSave} t={t} />
          <span style={{ fontFamily: F.body, fontSize: 10, color: C.muted, marginLeft: 4 }}>
            {currentUser.role === 'installer' ? `· ${t.jobChatNotifiedSales}` : ''}
          </span>
        </div>
      </div>
    </Card>
  );
};

// ============ JOB DETAIL / EDIT ============
const JobDetail = ({ job, schedule, fullSchedule, setSchedule, onBack, onSave, onDelete, onComplete, onRestore, onPushToSchedule, onApprove, onSendBack, onRequestComplete, onInstallerActivity, t, clients, sales, addClient, addSales, clientContacts, addClientContact, updateContactPhone, updateContactRole, readOnly, isPendingMode, role }) => {
  const [draft, setDraft] = useState(job ? {
    ...job,
    files: job.files || (job.attachment ? [{ id: 'f0', name: job.attachment, section: 'Others' }] : []),
    links: job.links || [],
    productionPhotos: job.productionPhotos || [],
    productionInstructions: job.productionInstructions || '',
    doPhoto: job.doPhoto || null,
    completionPhotos: job.completionPhotos || [],
    clientContactName: job.clientContactName || '',
  } : {
    id: Date.now(), date: '2026-04-30', day: 'Thu', production: false, client: '', clientContactName: '',
    punctuality: 'blue', timeStart: '', timeEnd: '', job: '', location: '',
    do: false, sales: '', installers: [],
    files: [], links: [], productionPhotos: [], productionInstructions: '', doPhoto: null, completionPhotos: [],
  });
  const [showProposal, setShowProposal] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState(null);
  const [readingFile, setReadingFile] = useState(false);
  const [addingLinkSection, setAddingLinkSection] = useState(null);
  const [newLinkUrl, setNewLinkUrl] = useState('');
  const [newLinkLabel, setNewLinkLabel] = useState('');
  const [newLinkExpiry, setNewLinkExpiry] = useState(''); // ISO date string YYYY-MM-DD or ''
  const [linkError, setLinkError] = useState('');
  const [copiedLink, setCopiedLink] = useState(null);
  const [galleryStart, setGalleryStart] = useState(null); // index when gallery open, null when closed
  const [confirmingRestore, setConfirmingRestore] = useState(false);
  // Suggestions modal: { draft, requestNotify, suggestions: { altInstallers, altTimes } } | null
  const [suggestionsPopup, setSuggestionsPopup] = useState(null);

  const clashes = readOnly ? [] : detectClashes(schedule, draft, job?.id);
  const proposed = draft.job ? proposeInstallers(draft.job) : [];

  const contactsForClient = draft.client ? (clientContacts[draft.client] || []) : [];

  // Role + workflow-state derived flags
  const isScheduler = role === 'scheduler';
  const isSales = role === 'sales';
  const isAwaiting = job?.status === 'awaiting_approval';
  // Sales can't edit jobs that have been sent for approval — they have to send back first.
  const lockedForSales = isSales && isAwaiting;
  const effectiveReadOnly = readOnly || lockedForSales;

  const toggleInstaller = (id) => {
    if (readOnly) return;
    setDraft(d => ({
      ...d,
      installers: d.installers.includes(id) ? d.installers.filter(x => x !== id) : [...d.installers, id]
    }));
  };

  const handleAttachmentUpload = (section = 'Others') => {
    if (readOnly) return;
    const newFile = { id: `f${Date.now()}`, name: 'client-brief.pdf', section };
    setDraft(d => ({ ...d, files: [...(d.files || []), newFile] }));
    setReadingFile(true);
    setAiSuggestions(null);
    setTimeout(() => {
      setReadingFile(false);
      setAiSuggestions({
        job: 'Suntec roadshow booth — vinyl walls + LED accent + product display',
        location: 'Suntec Convention Hall 401, Level 4',
      });
    }, 1800);
  };

  const removeFile = (fileId) => setDraft(d => ({ ...d, files: d.files.filter(f => f.id !== fileId) }));
  const removeLink = (linkId) => setDraft(d => ({ ...d, links: d.links.filter(l => l.id !== linkId) }));

  const submitNewLink = () => {
    const url = newLinkUrl.trim();
    if (!url) { setLinkError(t.invalidUrl); return; }
    let normalized = url;
    if (!/^https?:\/\//i.test(normalized)) normalized = 'https://' + normalized;
    try { new URL(normalized); } catch { setLinkError(t.invalidUrl); return; }
    setDraft(d => ({
      ...d,
      links: [...(d.links || []), {
        id: `l${Date.now()}`,
        url: normalized,
        label: newLinkLabel.trim(),
        section: addingLinkSection,
        addedAt: new Date().toISOString(),
        expiresAt: newLinkExpiry ? new Date(newLinkExpiry).toISOString() : null,
      }]
    }));
    setNewLinkUrl(''); setNewLinkLabel(''); setNewLinkExpiry(''); setLinkError(''); setAddingLinkSection(null);
  };

  const copyLink = async (link) => {
    try {
      await navigator.clipboard.writeText(link.url);
      setCopiedLink(link.id);
      setTimeout(() => setCopiedLink(null), 1500);
    } catch {}
  };

  const addProductionPhoto = () => {
    if (readOnly) return;
    // Mock: in real app this would open camera/gallery and upload to R2
    const id = `p${Date.now()}`;
    const seed = Math.floor(Math.random() * 1000);
    setDraft(d => ({
      ...d,
      productionPhotos: [...(d.productionPhotos || []), { id, url: `https://picsum.photos/seed/${seed}/600/800`, caption: '' }]
    }));
  };
  const removePhoto = (id) => setDraft(d => ({ ...d, productionPhotos: d.productionPhotos.filter(p => p.id !== id) }));

  const setDOPhoto = () => {
    if (readOnly) return;
    setDraft(d => ({ ...d, doPhoto: { url: `https://picsum.photos/seed/do${Date.now()}/400/600`, filename: 'signed-do.jpg' } }));
  };
  const removeDOPhoto = () => setDraft(d => ({ ...d, doPhoto: null }));

  const addCompletionPhoto = () => {
    if (effectiveReadOnly) return;
    const id = `cp${Date.now()}`;
    const seed = Math.floor(Math.random() * 1000);
    setDraft(d => ({
      ...d,
      completionPhotos: [...(d.completionPhotos || []), { id, url: `https://picsum.photos/seed/${seed}/600/800`, caption: '' }]
    }));
  };
  const removeCompletionPhoto = (id) => setDraft(d => ({ ...d, completionPhotos: (d.completionPhotos || []).filter(p => p.id !== id) }));

  return (
    <>
      <div style={{ padding: '20px 20px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <button onClick={onBack} style={{ background: 'none', border: 'none', padding: 0, marginBottom: 8, color: C.muted, display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, fontFamily: F.body, cursor: 'pointer' }}>
            <ArrowLeft size={14} /> {t.backToSchedule}
          </button>
          <h1 style={{ margin: 0, fontFamily: F.display, fontSize: 24, fontWeight: 500, color: C.ink, letterSpacing: '-0.02em' }}>
            {job ? t.editJob : t.newJob}
          </h1>
        </div>
      </div>

      <div style={{ padding: '0 20px 24px' }}>
        {/* Awaiting-approval banner — visible when job has been sent to scheduler */}
        {isAwaiting && (
          <Card style={{
            background: C.accent2, border: `1px solid ${C.accent}55`, marginBottom: 14
          }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: C.card, color: C.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Inbox size={14} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: F.body, fontSize: 12, color: C.accent, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>
                  {t.awaitingApproval}
                </div>
                <div style={{ fontFamily: F.body, fontSize: 12, color: C.ink2, lineHeight: 1.5 }}>
                  {t.sentBy} <strong>{job?.submittedBy || job?.sales}</strong>
                  {job?.submittedForApprovalAt && (
                    <> · {t.sentAt} {new Date(job.submittedForApprovalAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</>
                  )}
                </div>
                {isSales && (
                  <div style={{ marginTop: 6, fontFamily: F.body, fontSize: 11, color: C.muted, fontStyle: 'italic' }}>
                    {t.salesNoticeAwaiting}
                  </div>
                )}
              </div>
            </div>
          </Card>
        )}

        {clashes.length > 0 && (() => {
          const hardClashes = clashes.filter(c => c.severity === 'hard');
          const softClashes = clashes.filter(c => c.severity === 'soft');
          const tone = hardClashes.length > 0 ? { bg: C.warnBg, border: C.warn, fg: C.warn } : { bg: C.accent2, border: C.accent + '55', fg: C.accent };
          return (
            <Card style={{ background: tone.bg, border: `1px solid ${tone.border}`, marginBottom: 14 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <AlertCircle size={16} color={tone.fg} style={{ flexShrink: 0, marginTop: 1 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: F.body, fontSize: 13, color: tone.fg, fontWeight: 500, marginBottom: 4 }}>
                    {clashes.length} {t.clashesDetected}
                    {softClashes.length > 0 && hardClashes.length === 0 && ` — ${t.pendingClashWarning}`}
                  </div>
                  {clashes.map((c, i) => (
                    <div key={i} style={{ fontFamily: F.body, fontSize: 12, color: C.ink2, marginTop: 3, display: 'flex', gap: 6, alignItems: 'center' }}>
                      <span>·</span>
                      <span>{c.text}</span>
                      {c.severity === 'soft' && <Pill tone="accent">{t.pendingPill}</Pill>}
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          );
        })()}

        <Card>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
            <Field label={t.date}>
              <Input type="date" value={draft.date} onChange={v => {
                const d = new Date(v);
                setDraft({ ...draft, date: v, day: ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getDay()] });
              }} />
            </Field>
            <Field label={t.day}>
              <div style={{ padding: '10px 12px', background: C.bg, borderRadius: 8, fontFamily: F.body, fontSize: 14, color: C.ink2, border: `1px solid ${C.line}` }}>{draft.day || '—'}</div>
            </Field>
          </div>

          <Field label={t.client}>
            <SelectAddable
              t={t}
              value={draft.client}
              options={clients}
              placeholder={t.clientPick}
              addPrompt={t.addNewClientPrompt}
              onChange={(v, isNew) => {
                if (isNew) addClient(v);
                setDraft({ ...draft, client: v });
              }}
            />
          </Field>

          {draft.client && (
            <Field label={t.contactPerson}>
              <ContactPicker
                t={t}
                clientName={draft.client}
                contacts={contactsForClient}
                value={draft.clientContactName}
                onChange={(name) => setDraft({ ...draft, clientContactName: name })}
                onAddContact={(c) => addClientContact(draft.client, c)}
                onUpdatePhone={(name, phone) => updateContactPhone(draft.client, name, phone)}
                onUpdateRole={(name, role) => updateContactRole(draft.client, name, role)}
              />
            </Field>
          )}

          <Field label={t.jobDescription}>
            <AISmartTextarea
              value={draft.job}
              onChange={(v) => setDraft({ ...draft, job: v })}
              placeholder={t.jobDescPlaceholder}
              rows={3}
              t={t}
              hasAttachments={(draft.files?.length || 0) + (draft.links?.length || 0) > 0}
              suggestionWhenEmpty="Roadshow booth bump-in — 6m × 4m, LED feature wall, vinyl-clad side panels. Overnight install with fume extraction. Coordinate with venue for goods lift access."
              improvementForText={(orig) => mockImprove(orig)}
              disabled={readOnly}
            />
            {readingFile && (
              <div style={{ marginTop: 6, padding: '8px 10px', fontFamily: F.body, fontSize: 12, color: C.muted, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />
                {t.readingFile}
              </div>
            )}
          </Field>

          <Field label={t.locationAddress}>
            <Input value={draft.location} onChange={v => setDraft({ ...draft, location: v })} placeholder={t.locationPlaceholder} />
            {aiSuggestions && aiSuggestions.location && draft.location !== aiSuggestions.location && (
              <SuggestChip t={t} text={aiSuggestions.location} onUse={() => setDraft({ ...draft, location: aiSuggestions.location })} />
            )}
          </Field>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Field label={t.timeStart}>
              <Select value={draft.timeStart} onChange={v => setDraft({ ...draft, timeStart: v })} options={TIME_SLOTS} placeholder={t.pickTime} />
            </Field>
            <Field label={t.timeEnd}>
              <Select value={draft.timeEnd || ''} onChange={v => setDraft({ ...draft, timeEnd: v || null })} options={TIME_SLOTS} placeholder="—" />
            </Field>
          </div>

          <Field label={t.punctuality}>
            <div style={{ display: 'flex', gap: 8 }}>
              {[
                { v: 'red', label: t.strictOnTime, col: C.red },
                { v: 'blue', label: t.flexibleWindow, col: C.blue },
              ].map(opt => (
                <button key={opt.v} onClick={() => setDraft({ ...draft, punctuality: opt.v })}
                  style={{ flex: 1, padding: '10px 12px', borderRadius: 8, border: `2px solid ${draft.punctuality === opt.v ? opt.col : C.line}`,
                    background: draft.punctuality === opt.v ? (opt.v === 'red' ? '#FCE5E5' : '#E5EEFC') : C.card,
                    fontFamily: F.body, fontSize: 13, color: C.ink2, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
                  <span style={{ width: 12, height: 12, borderRadius: 3, background: opt.col }} />
                  {opt.label}
                </button>
              ))}
            </div>
          </Field>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', border: `1px solid ${C.line}`, borderRadius: 8, fontFamily: F.body, fontSize: 13, color: C.ink2, cursor: 'pointer' }}>
              <input type="checkbox" checked={draft.production} onChange={e => setDraft({ ...draft, production: e.target.checked })} disabled={readOnly} style={{ accentColor: C.accent }} />
              {t.productionReady}
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', border: `1px solid ${C.line}`, borderRadius: 8, fontFamily: F.body, fontSize: 13, color: C.ink2, cursor: 'pointer' }}>
              <input type="checkbox" checked={draft.do} onChange={e => setDraft({ ...draft, do: e.target.checked })} disabled={readOnly} style={{ accentColor: C.accent }} />
              {t.doShort}
            </label>
          </div>

          {/* Production photos & instructions — visible only when Production is ticked */}
          {draft.production && (
            <div style={{ background: C.bg, padding: 12, borderRadius: 10, marginBottom: 12, border: `1px solid ${C.line}` }}>
              <SectionLabel>{t.productionPhotos}</SectionLabel>
              {(draft.productionPhotos || []).length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginBottom: 10 }}>
                  {draft.productionPhotos.map((p, i) => (
                    <div key={p.id} style={{ position: 'relative', aspectRatio: '1', borderRadius: 8, overflow: 'hidden', cursor: 'pointer', background: C.line }}
                      onClick={() => setGalleryStart(i)}>
                      <img src={p.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      {!readOnly && (
                        <button onClick={(e) => { e.stopPropagation(); removePhoto(p.id); }}
                          style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(0,0,0,0.65)', color: '#fff', border: 'none', borderRadius: '50%', width: 22, height: 22, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <X size={12} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {!readOnly && (
                <button onClick={addProductionPhoto} style={{ width: '100%', padding: 10, border: `1.5px dashed ${C.line}`, borderRadius: 8, background: 'transparent', color: C.muted, fontFamily: F.body, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 10 }}>
                  <Camera size={13} /> {t.addPhoto}
                </button>
              )}

              <SectionLabel>{t.productionInstructions}</SectionLabel>
              <AISmartTextarea
                value={draft.productionInstructions || ''}
                onChange={(v) => setDraft({ ...draft, productionInstructions: v })}
                placeholder={t.productionInstructionsPlaceholder}
                rows={3}
                t={t}
                hasAttachments={(draft.files?.length || 0) + (draft.links?.length || 0) > 0 || (draft.productionPhotos?.length || 0) > 0}
                suggestionWhenEmpty="Use 3M IJ180 vinyl for side panels with overlaminate. LED strips wired in series with 12V 200W IP65 driver. Pre-test entire LED loop before shipping. Bubble-wrap all acrylic edges. Confirm goods lift dimensions before crating."
                improvementForText={(orig) => mockImprove(orig)}
                disabled={readOnly}
              />
            </div>
          )}

          {/* Signed DO photo — visible only when DO ticked */}
          {draft.do && (
            <div style={{ background: C.bg, padding: 12, borderRadius: 10, marginBottom: 12, border: `1px solid ${C.line}` }}>
              <SectionLabel>{t.doProof}</SectionLabel>
              {draft.doPhoto ? (
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: 8, background: C.card, borderRadius: 8 }}>
                  <img src={draft.doPhoto.url} alt="signed DO" onClick={() => setGalleryStart(0)}
                    style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 6, cursor: 'pointer' }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: F.body, fontSize: 13, color: C.ink, fontWeight: 500 }}>{draft.doPhoto.filename}</div>
                    <div style={{ fontFamily: F.body, fontSize: 11, color: C.muted }}>Tap to view full size</div>
                  </div>
                  {!readOnly && (
                    <button onClick={removeDOPhoto} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted, padding: 6 }}>
                      <X size={14} />
                    </button>
                  )}
                </div>
              ) : !readOnly && (
                <button onClick={setDOPhoto} style={{ width: '100%', padding: 12, border: `1.5px dashed ${C.line}`, borderRadius: 8, background: 'transparent', color: C.muted, fontFamily: F.body, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <FileSignature size={14} /> {t.uploadDOPhoto}
                </button>
              )}
            </div>
          )}

          {/* Completion photos — only meaningful for jobs that are scheduled or completed.
              Pending/awaiting jobs aren't actually being executed, so we hide it there. */}
          {(job?.status === 'scheduled' || job?.status === 'completed' || job?.completed) && (
            <div style={{ background: C.bg, padding: 12, borderRadius: 10, marginBottom: 12, border: `1px solid ${C.line}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <SectionLabel>{t.completionPhotos}</SectionLabel>
                {(draft.completionPhotos || []).length === 0 && job?.status === 'scheduled' && !readOnly && (
                  <span style={{ fontFamily: F.body, fontSize: 10, color: C.warn, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <AlertCircle size={11} /> {t.noPhotosYet}
                  </span>
                )}
              </div>
              {(draft.completionPhotos || []).length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginBottom: 10 }}>
                  {draft.completionPhotos.map((p) => (
                    <div key={p.id} style={{ position: 'relative', aspectRatio: '1', borderRadius: 8, overflow: 'hidden', background: C.line }}>
                      <img src={p.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      {!effectiveReadOnly && (
                        <button onClick={() => removeCompletionPhoto(p.id)}
                          style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(0,0,0,0.65)', color: '#fff', border: 'none', borderRadius: '50%', width: 22, height: 22, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <X size={12} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {!effectiveReadOnly && (
                <button onClick={addCompletionPhoto} style={{ width: '100%', padding: 10, border: `1.5px dashed ${C.line}`, borderRadius: 8, background: 'transparent', color: C.muted, fontFamily: F.body, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  <Camera size={13} /> {t.addCompletionPhoto}
                </button>
              )}
            </div>
          )}

          <Field label={t.salesPOC}>
            <SelectAddable
              t={t}
              value={draft.sales}
              options={sales}
              placeholder={t.pickSales}
              addPrompt={t.addNewSalesPrompt}
              onChange={(v, isNew) => {
                if (isNew) addSales(v);
                setDraft({ ...draft, sales: v });
              }}
            />
          </Field>
        </Card>

        <Card style={{ marginTop: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <SectionLabel>{t.installers}</SectionLabel>
            {proposed.length > 0 && (
              <button onClick={() => setShowProposal(!showProposal)} style={{ background: 'none', border: 'none', color: C.accent, fontFamily: F.body, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Sparkles size={12} /> {showProposal ? t.hide : t.suggest}
              </button>
            )}
          </div>

          {showProposal && proposed.length > 0 && (
            <div style={{ background: C.accent2, borderRadius: 8, padding: 12, marginBottom: 12 }}>
              <div style={{ fontFamily: F.body, fontSize: 11, color: C.accent, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
                <Sparkles size={12} /> {t.suggestedBased}
              </div>
              {proposed.map(p => (
                <div key={p.id} style={{ padding: '6px 0', borderBottom: `1px solid ${C.accent}22`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontFamily: F.body, fontSize: 13, color: C.ink, fontWeight: 500 }}>{p.name}</div>
                    <div style={{ fontFamily: F.body, fontSize: 11, color: C.ink2 }}>{p.strengths.join(' · ')}</div>
                  </div>
                  <button onClick={() => toggleInstaller(p.id)} style={{ background: draft.installers.includes(p.id) ? C.accent : 'transparent', color: draft.installers.includes(p.id) ? '#fff' : C.accent, border: `1px solid ${C.accent}`, borderRadius: 999, padding: '4px 10px', fontFamily: F.body, fontSize: 11, cursor: 'pointer' }}>
                    {draft.installers.includes(p.id) ? t.added : t.addBtn}
                  </button>
                </div>
              ))}
            </div>
          )}

          {STAFF.filter(s => s.role.includes('Install')).map(s => {
            const selected = draft.installers.includes(s.id);
            return (
              <div key={s.id} onClick={() => toggleInstaller(s.id)} style={{
                padding: '10px 12px', borderRadius: 8, marginBottom: 6,
                background: selected ? C.accent2 : 'transparent',
                border: `1px solid ${selected ? C.accent : C.line}`,
                cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
              }}>
                <div>
                  <div style={{ fontFamily: F.body, fontSize: 13, color: C.ink, fontWeight: 500 }}>{s.name}</div>
                  <div style={{ fontFamily: F.body, fontSize: 11, color: C.muted }}>{s.role} · {s.exp}y · {s.strengths.slice(0, 2).join(', ')}</div>
                </div>
                {selected && <Check size={16} color={C.accent} />}
              </div>
            );
          })}
        </Card>

        {/* Sectioned attachments — files + links grouped by PTW / BCA / Others */}
        <Card style={{ marginTop: 12 }}>
          <SectionLabel>{t.attachment}</SectionLabel>
          {readingFile && (
            <div style={{ padding: '8px 10px', fontFamily: F.body, fontSize: 12, color: C.muted, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />
              {t.readingFile}
            </div>
          )}
          {['PTW', 'BCA', 'Others'].map((section) => {
            const sectionLabel = section === 'PTW' ? t.sectionPTW : section === 'BCA' ? t.sectionBCA : t.sectionOthers;
            const sectionFiles = (draft.files || []).filter(f => f.section === section);
            const sectionLinks = (draft.links || []).filter(l => l.section === section);
            const hasItems = sectionFiles.length > 0 || sectionLinks.length > 0;
            const isAdding = addingLinkSection === section;

            return (
              <div key={section} style={{ marginBottom: 12, paddingBottom: 12, borderBottom: section !== 'Others' ? `1px solid ${C.line}` : 'none' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontFamily: F.body, fontSize: 12, fontWeight: 600, color: C.ink, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{sectionLabel}</span>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button onClick={() => handleAttachmentUpload(section)} title={t.files}
                      style={{ background: 'none', border: `1px solid ${C.line}`, borderRadius: 6, padding: '4px 8px', cursor: 'pointer', color: C.muted, fontFamily: F.body, fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Paperclip size={11} /> {t.files.length > 8 ? '' : t.files}
                    </button>
                    <button onClick={() => { setAddingLinkSection(section); setLinkError(''); }} title={t.links}
                      style={{ background: 'none', border: `1px solid ${C.line}`, borderRadius: 6, padding: '4px 8px', cursor: 'pointer', color: C.muted, fontFamily: F.body, fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Link2 size={11} /> {t.addLink.replace('+ ', '')}
                    </button>
                  </div>
                </div>

                {/* Files in this section */}
                {sectionFiles.map(f => (
                  <div key={f.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', background: C.bg, borderRadius: 6, marginBottom: 4 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontFamily: F.body, fontSize: 13, color: C.ink2, minWidth: 0, flex: 1 }}>
                      <FileText size={13} color={C.accent} style={{ flexShrink: 0 }} />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                    </div>
                    <button onClick={() => removeFile(f.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted, padding: 4 }}>
                      <X size={13} />
                    </button>
                  </div>
                ))}

                {/* Links in this section */}
                {sectionLinks.map(l => {
                  const display = l.label || l.url;
                  const justCopied = copiedLink === l.id;
                  const expStatus = expiryStatus(l, t);
                  return (
                    <div key={l.id} style={{
                      display: 'flex', flexDirection: 'column',
                      padding: '8px 10px',
                      background: expStatus?.urgent ? (expStatus.tone === 'bad' ? C.badBg : C.warnBg) : C.bg,
                      border: expStatus?.urgent ? `1px solid ${expStatus.tone === 'bad' ? C.bad + '55' : C.warn + '55'}` : 'none',
                      borderRadius: 6, marginBottom: 4
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontFamily: F.body, fontSize: 13, color: C.ink2, minWidth: 0, flex: 1 }}>
                          <Link2 size={13} color={C.accent} style={{ flexShrink: 0 }} />
                          <div style={{ minWidth: 0, flex: 1 }}>
                            {l.label && <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: C.ink, fontWeight: 500 }}>{l.label}</div>}
                            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: C.muted, fontSize: 11 }}>{l.url}</div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                          <button onClick={() => copyLink(l)} title={t.copy}
                            style={{ background: justCopied ? C.goodBg : 'transparent', border: 'none', cursor: 'pointer', color: justCopied ? C.good : C.muted, padding: 6, borderRadius: 4 }}>
                            {justCopied ? <Check size={13} /> : <Copy size={13} />}
                          </button>
                          <a href={l.url} target="_blank" rel="noopener noreferrer" title={t.open}
                            style={{ color: C.accent, padding: 6, borderRadius: 4, display: 'flex', alignItems: 'center' }}>
                            <ExternalLink size={13} />
                          </a>
                          {!readOnly && (
                            <button onClick={() => removeLink(l.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted, padding: 6 }}>
                              <X size={13} />
                            </button>
                          )}
                        </div>
                      </div>
                      {/* Metadata strip — added date + expiry */}
                      {(l.addedAt || l.expiresAt) && (
                        <div style={{ display: 'flex', gap: 10, marginTop: 6, paddingTop: 6, borderTop: `1px solid ${expStatus?.urgent ? 'transparent' : C.line}`, fontFamily: F.body, fontSize: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                          {l.addedAt && (
                            <span style={{ color: C.muted, display: 'flex', alignItems: 'center', gap: 3 }}>
                              <Clock size={10} />{t.linkAdded} {formatAddedDate(l.addedAt)}
                            </span>
                          )}
                          {expStatus && (
                            <span style={{
                              color: expStatus.tone === 'bad' ? C.bad : expStatus.tone === 'warn' ? C.warn : C.muted,
                              fontWeight: expStatus.urgent ? 600 : 400,
                              display: 'flex', alignItems: 'center', gap: 3
                            }}>
                              <AlertCircle size={10} />{expStatus.label}
                            </span>
                          )}
                          {!l.expiresAt && !readOnly && (
                            <button
                              onClick={() => {
                                // Quick set 3-day expiry
                                const d = new Date();
                                d.setDate(d.getDate() + 3);
                                setDraft(dr => ({
                                  ...dr,
                                  links: dr.links.map(x => x.id === l.id ? { ...x, expiresAt: d.toISOString() } : x)
                                }));
                              }}
                              style={{ background: 'none', border: 'none', color: C.accent, fontFamily: F.body, fontSize: 10, cursor: 'pointer', padding: 0, textDecoration: 'underline' }}>
                              {t.setExpiry}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Add link inline form */}
                {isAdding && (
                  <div style={{ background: C.accent2, padding: 10, borderRadius: 6, marginTop: 4 }}>
                    <input
                      autoFocus
                      type="url"
                      value={newLinkUrl}
                      onChange={e => { setNewLinkUrl(e.target.value); setLinkError(''); }}
                      placeholder={t.pasteUrl}
                      style={{ width: '100%', padding: '8px 10px', border: `1px solid ${linkError ? C.bad : C.line}`, borderRadius: 6, fontFamily: F.body, fontSize: 13, marginBottom: 6, outline: 'none', boxSizing: 'border-box' }}
                    />
                    <input
                      type="text"
                      value={newLinkLabel}
                      onChange={e => setNewLinkLabel(e.target.value)}
                      placeholder={t.linkLabelPlaceholder}
                      style={{ width: '100%', padding: '8px 10px', border: `1px solid ${C.line}`, borderRadius: 6, fontFamily: F.body, fontSize: 13, marginBottom: 8, outline: 'none', boxSizing: 'border-box' }}
                    />

                    {/* Expiry preset buttons + custom date */}
                    <div style={{ marginBottom: 8 }}>
                      <div style={{ fontFamily: F.body, fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{t.setExpiry}</div>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
                        {[
                          { label: t.presetExpiryWT, days: 3 },
                          { label: t.presetExpiry7, days: 7 },
                          { label: t.presetExpiry30, days: 30 },
                        ].map((p) => {
                          const computeDate = (days) => {
                            const d = new Date();
                            d.setDate(d.getDate() + days);
                            return d.toISOString().split('T')[0];
                          };
                          const presetVal = computeDate(p.days);
                          const isActive = newLinkExpiry === presetVal;
                          return (
                            <button key={p.days} onClick={() => setNewLinkExpiry(presetVal)}
                              style={{ padding: '4px 8px', borderRadius: 999, border: `1px solid ${isActive ? C.accent : C.line}`, background: isActive ? C.accent : C.card, color: isActive ? '#fff' : C.ink2, fontFamily: F.body, fontSize: 10, cursor: 'pointer' }}>
                              {p.label}
                            </button>
                          );
                        })}
                        {newLinkExpiry && (
                          <button onClick={() => setNewLinkExpiry('')}
                            style={{ padding: '4px 8px', borderRadius: 999, border: `1px solid ${C.line}`, background: 'transparent', color: C.muted, fontFamily: F.body, fontSize: 10, cursor: 'pointer' }}>
                            {t.noExpiry}
                          </button>
                        )}
                      </div>
                      <input
                        type="date"
                        value={newLinkExpiry}
                        onChange={e => setNewLinkExpiry(e.target.value)}
                        style={{ width: '100%', padding: '6px 10px', border: `1px solid ${C.line}`, borderRadius: 6, fontFamily: F.body, fontSize: 12, color: C.ink2, background: C.card, outline: 'none', boxSizing: 'border-box' }}
                      />
                    </div>

                    {linkError && <div style={{ fontSize: 11, color: C.bad, fontFamily: F.body, marginBottom: 6 }}>{linkError}</div>}
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => { setAddingLinkSection(null); setNewLinkUrl(''); setNewLinkLabel(''); setNewLinkExpiry(''); setLinkError(''); }}
                        style={{ flex: 1, padding: '8px 12px', borderRadius: 6, border: `1px solid ${C.line}`, background: C.card, color: C.ink2, fontFamily: F.body, fontSize: 12, cursor: 'pointer' }}>
                        {t.cancel}
                      </button>
                      <button onClick={submitNewLink}
                        style={{ flex: 1, padding: '8px 12px', borderRadius: 6, border: 'none', background: C.accent, color: '#fff', fontFamily: F.body, fontSize: 12, cursor: 'pointer' }}>
                        {t.save}
                      </button>
                    </div>
                  </div>
                )}

                {!hasItems && !isAdding && (
                  <div style={{ fontFamily: F.body, fontSize: 11, color: C.muted, fontStyle: 'italic', padding: '4px 0' }}>
                    —
                  </div>
                )}
              </div>
            );
          })}
        </Card>

        {/* Live chat thread — visible on existing jobs so sales/scheduler can read
            installer updates and reply. Hidden on the new-job draft form. */}
        {job && setSchedule && fullSchedule && (
          <JobChatThread
            job={job}
            schedule={fullSchedule}
            setSchedule={setSchedule}
            currentUser={{
              role: role || 'sales',
              name: role === 'scheduler' ? 'Scheduler' : (draft.sales || (role === 'sales' ? 'Sales' : 'Sales')),
            }}
            t={t}
            onInstallerActivity={onInstallerActivity}
          />
        )}

        {/* Notification preview */}
        {(draft.installers.length > 0 || draft.sales) && (
          <Card style={{ marginTop: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <Bell size={14} color={C.accent} />
              <SectionLabel>{t.notifications}</SectionLabel>
            </div>
            <div style={{ fontFamily: F.body, fontSize: 12, color: C.ink2, marginBottom: 10 }}>
              {t.willNotify} {t.viaTelegram}:
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {draft.installers.map(id => {
                const s = STAFF.find(x => x.id === id);
                if (!s) return null;
                const langLabel = LANGS.find(l => l.code === s.tgLang)?.native;
                return (
                  <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', background: s.tgEnrolled ? C.goodBg : C.warnBg, borderRadius: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontFamily: F.body, fontSize: 13, color: C.ink }}>{s.name}</span>
                      {s.tgEnrolled && <span style={{ fontFamily: F.body, fontSize: 10, color: C.muted }}>· {langLabel}</span>}
                    </div>
                    {s.tgEnrolled
                      ? <span style={{ fontFamily: F.body, fontSize: 11, color: C.good }}>✓ Telegram</span>
                      : <span style={{ fontFamily: F.body, fontSize: 11, color: C.warn }}>⚠ {t.notEnrolled}</span>
                    }
                  </div>
                );
              })}
              {draft.sales && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', background: C.goodBg, borderRadius: 6 }}>
                  <span style={{ fontFamily: F.body, fontSize: 13, color: C.ink }}>{draft.sales} <span style={{ fontSize: 10, color: C.muted }}>· {t.salesPOC}</span></span>
                  <span style={{ fontFamily: F.body, fontSize: 11, color: C.good }}>✓ Telegram</span>
                </div>
              )}
            </div>
            {job && (
              <div style={{ marginTop: 10, fontFamily: F.body, fontSize: 11, color: C.muted, fontStyle: 'italic' }}>
                {t.onlyChangedNotify}
              </div>
            )}
          </Card>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
          {job && !readOnly && !lockedForSales && <Btn variant="ghost" onClick={() => { onDelete(job.id); }}>{t.delete}</Btn>}
          {/* Complete button — routes through CompletionModal which enforces photo requirement
              (scheduler can override) per boss feedback #4.1 */}
          {job && !readOnly && !job.completed && !isPendingMode && !isAwaiting && (
            <Btn variant="ghost" icon={CheckCircle2} onClick={() => onRequestComplete(job)}>{t.completeJob}</Btn>
          )}
          {readOnly && job?.completed && <Btn variant="ghost" icon={RotateCcw} onClick={() => setConfirmingRestore(true)}>{t.restoreJob}</Btn>}
          <div style={{ flex: 1 }} />
          <Btn variant="ghost" onClick={onBack}>{readOnly ? t.backToSchedule : t.cancel}</Btn>

          {/* === Pending mode (for both sales and scheduler) === */}
          {!readOnly && isPendingMode && !isAwaiting && (
            <>
              <Btn variant="ghost" icon={Check} onClick={() => onSave({ ...draft, status: 'pending' }, false)} disabled={!draft.timeStart}>{t.saveAsPending}</Btn>
              <Btn variant="accent" icon={isSales ? Send : Check} onClick={() => {
                // For sales: route through workload preview → awaiting_approval
                // For scheduler: same as before — clash check then directly schedule
                const hardInstallerClashes = detectClashes(schedule, draft, job?.id)
                  .filter(c => c.severity === 'hard' && c.type === 'installer');
                if (isSales) {
                  // Sales path: open workload preview first, then on confirm push to awaiting
                  if (hardInstallerClashes.length > 0) {
                    const sugg = suggestAlternatives(schedule, draft, job?.id);
                    setSuggestionsPopup({ draft, requestNotify: false, suggestions: sugg, action: 'send_to_scheduler' });
                  } else {
                    onPushToSchedule(draft, false); // parent decides workload-preview-then-awaiting
                  }
                } else {
                  // Scheduler path: directly schedule (notify on save)
                  if (hardInstallerClashes.length > 0) {
                    const sugg = suggestAlternatives(schedule, draft, job?.id);
                    setSuggestionsPopup({ draft, requestNotify: true, suggestions: sugg, action: 'push' });
                  } else {
                    onPushToSchedule({ ...draft, status: 'scheduled' }, true);
                  }
                }
              }} disabled={!draft.timeStart || draft.installers.length === 0}>
                {isSales ? t.sendToScheduler : t.pushToSchedule}
              </Btn>
            </>
          )}

          {/* === Awaiting-approval mode === */}
          {!readOnly && isAwaiting && isSales && (
            <Btn variant="ghost" icon={ArrowLeft} onClick={() => onSendBack(job.id)}>{t.sendBackToSales}</Btn>
          )}
          {!readOnly && isAwaiting && isScheduler && (
            <>
              <Btn variant="ghost" icon={ArrowLeft} onClick={() => onSendBack(job.id)}>{t.sendBackToSales}</Btn>
              <Btn variant="accent" icon={ShieldCheck} onClick={() => {
                const hardInstallerClashes = detectClashes(schedule, draft, job?.id)
                  .filter(c => c.severity === 'hard' && c.type === 'installer');
                if (hardInstallerClashes.length > 0) {
                  const sugg = suggestAlternatives(schedule, draft, job?.id);
                  setSuggestionsPopup({ draft, requestNotify: true, suggestions: sugg, action: 'approve' });
                } else {
                  onApprove(draft, true);
                }
              }} disabled={!draft.timeStart || draft.installers.length === 0}>
                {t.approveAndSchedule}
              </Btn>
            </>
          )}

          {/* === Scheduled (already-confirmed) mode === */}
          {!readOnly && !isPendingMode && !isAwaiting && ((draft.installers.length > 0 || draft.sales) ? (
            <Btn variant="accent" icon={Bell} onClick={() => {
              const hardInstallerClashes = detectClashes(schedule, draft, job?.id)
                .filter(c => c.severity === 'hard' && c.type === 'installer');
              if (hardInstallerClashes.length > 0) {
                const sugg = suggestAlternatives(schedule, draft, job?.id);
                setSuggestionsPopup({ draft, requestNotify: true, suggestions: sugg, action: 'save' });
              } else {
                onSave({ ...draft, status: 'scheduled' }, true);
              }
            }} disabled={!draft.timeStart}>{t.notifySaveBtn}</Btn>
          ) : (
            <Btn variant="accent" icon={Check} onClick={() => onSave({ ...draft, status: 'scheduled' }, false)} disabled={!draft.timeStart}>{t.save}</Btn>
          ))}
        </div>
      </div>

      {/* Confirm restore modal */}
      {confirmingRestore && (
        <div onClick={() => setConfirmingRestore(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 150, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: C.card, borderRadius: 14, padding: 20, maxWidth: 360, width: '100%' }}>
            <div style={{ fontFamily: F.display, fontSize: 18, color: C.ink, marginBottom: 8 }}>{t.restoreJob}</div>
            <div style={{ fontFamily: F.body, fontSize: 13, color: C.ink2, lineHeight: 1.55, marginBottom: 16 }}>{t.confirmRestore}</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Btn variant="ghost" full onClick={() => setConfirmingRestore(false)}>{t.cancel}</Btn>
              <Btn variant="accent" full icon={RotateCcw} onClick={() => { onRestore(job.id); setConfirmingRestore(false); }}>{t.restoreJob}</Btn>
            </div>
          </div>
        </div>
      )}

      {/* Clash suggestions popup — per-installer resolver */}
      {suggestionsPopup && (
        <ClashResolverModal
          popup={suggestionsPopup}
          t={t}
          onClose={() => setSuggestionsPopup(null)}
          onProceed={(modifiedDraft) => {
            const action = suggestionsPopup.action;
            if (action === 'push') {
              // Scheduler scheduling directly from pending
              onPushToSchedule({ ...modifiedDraft, status: 'scheduled' }, suggestionsPopup.requestNotify);
            } else if (action === 'send_to_scheduler') {
              // Sales sending to scheduler — parent handles workload preview then awaiting_approval
              onPushToSchedule(modifiedDraft, false);
            } else if (action === 'approve') {
              // Scheduler approving an awaiting-approval job
              onApprove(modifiedDraft, true);
            } else {
              // Default save (status: scheduled)
              onSave({ ...modifiedDraft, status: 'scheduled' }, suggestionsPopup.requestNotify);
            }
            setSuggestionsPopup(null);
          }}
        />
      )}

      {/* Photo gallery lightbox */}
      {galleryStart !== null && (
        <PhotoGallery
          photos={draft.do && draft.doPhoto && draft.productionPhotos.length === 0
            ? [draft.doPhoto]
            : (draft.productionPhotos || [])}
          startIndex={galleryStart}
          onClose={() => setGalleryStart(null)}
          t={t}
        />
      )}
    </>
  );
};

// ============ CHATBOT ============
const ChatPanel = ({ schedule, setSchedule, onClose, isFullscreen, onOpenFullscreen, t, lang }) => {
  const greetings = {
    en: "Hi. I can answer questions, search the web, or help draft schedule entries. What do you need?",
    zh: "你好。我可以回答问题、搜索网页或协助起草排程。需要什么帮助？",
    bn: "হ্যালো। আমি প্রশ্নের উত্তর দিতে পারি, ওয়েব সার্চ করতে পারি, বা সময়সূচী তৈরিতে সাহায্য করতে পারি। কী লাগবে?",
  };
  const [messages, setMessages] = useState([
    { role: 'assistant', text: greetings[lang] || greetings.en }
  ]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const [pendingDraft, setPendingDraft] = useState(null);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, thinking]);

  const handleSend = () => {
    if (!input.trim()) return;
    const userMsg = input.trim();
    setMessages(m => [...m, { role: 'user', text: userMsg }]);
    setInput('');
    setThinking(true);

    setTimeout(() => {
      setThinking(false);
      const lower = userMsg.toLowerCase();

      const responses = {
        en: {
          parsed: "I parsed this as a new job. Review before I add to the schedule:",
          search: "From a quick web search: Marina Bay Sands B1 loading bay operates 6 AM – 11 PM daily. Bump-in vehicles need a venue access pass arranged 48 hrs ahead via the Events team.",
          who: "Looking at this week:\n\n• Aaron Tan — booked Wed 9 AM (Uniqlo) and Thu 8 PM (DBS).\n• Ben Lim — booked Wed 9 AM (Uniqlo) and Thu 11 AM (Watsons).\n\nAaron has Friday open; Ben has Friday afternoon open.",
          help: "I can: answer schedule questions (\"who's free Friday?\"), draft new entries (\"book Shopee install Saturday\"), or search the web (\"MBS loading bay hours?\"). Try one.",
        },
        zh: {
          parsed: "我把它理解为一项新工作。请审核后再加入排程：",
          search: "网络搜索结果：滨海湾金沙 B1 装卸区每天 6 AM – 11 PM 开放。装卸车辆需提前 48 小时通过活动团队申请通行证。",
          who: "本周情况：\n\n• Aaron Tan — 周三上午9点（Uniqlo）和周四晚8点（DBS）已订。\n• Ben Lim — 周三上午9点（Uniqlo）和周四上午11点（Watsons）已订。\n\nAaron 周五整天有空；Ben 周五下午有空。",
          help: "我可以：回答排程问题（\"周五谁有空？\"）、起草新条目（\"周六预定 Shopee 安装\"）、或搜索网页（\"金沙装卸时间？\"）。试试看。",
        },
        bn: {
          parsed: "আমি এটিকে একটি নতুন কাজ হিসেবে বুঝেছি। সময়সূচীতে যোগ করার আগে পর্যালোচনা করুন:",
          search: "ওয়েব সার্চ থেকে: Marina Bay Sands B1 লোডিং বে প্রতিদিন সকাল 6টা – রাত 11টা চালু থাকে। গাড়িগুলোর জন্য 48 ঘণ্টা আগে Events team-এর কাছ থেকে অ্যাক্সেস পাস নিতে হবে।",
          who: "এই সপ্তাহ:\n\n• Aaron Tan — বুধ সকাল 9টা (Uniqlo) এবং বৃহঃ রাত 8টা (DBS) বুকড।\n• Ben Lim — বুধ সকাল 9টা (Uniqlo) এবং বৃহঃ সকাল 11টা (Watsons) বুকড।\n\nAaron-এর শুক্রবার ফাঁকা; Ben-এর শুক্র দুপুর ফাঁকা।",
          help: "আমি পারি: সময়সূচী সম্পর্কে উত্তর দিতে, নতুন এন্ট্রি খসড়া করতে, বা ওয়েব সার্চ করতে। একটা চেষ্টা করুন।",
        },
      };
      const R = responses[lang] || responses.en;

      // Detect intent across languages
      const isSchedule = /schedule|book|install|add|预定|安排|加入|安装|বুক|যোগ|ইনস্টল/i.test(userMsg);
      const isSearch = /search|what time|where|搜索|几点|哪里|সার্চ|কখন|কোথায়/i.test(userMsg);
      const isWho = /aaron|ben|who|谁|কে/i.test(userMsg);

      if (isSchedule) {
        const draft = {
          id: Date.now(),
          date: '2026-05-02',
          day: 'Sat',
          production: false,
          client: 'Shopee SG',
          punctuality: 'blue',
          timeStart: '2:00 PM',
          timeEnd: '6:00 PM',
          job: 'Roadshow booth install — vinyl graphics, LED accent strip',
          location: 'Suntec Convention Hall 401',
          do: false,
          sales: 'Wei Ling',
          installers: [2, 3],
          files: [],
          links: [],
        };
        setPendingDraft(draft);
        setMessages(m => [...m, { role: 'assistant', text: R.parsed, draft }]);
      } else if (isSearch) {
        setMessages(m => [...m, { role: 'assistant', text: R.search, search: true }]);
      } else if (isWho) {
        setMessages(m => [...m, { role: 'assistant', text: R.who }]);
      } else {
        setMessages(m => [...m, { role: 'assistant', text: R.help }]);
      }
    }, 900);
  };

  const confirmDraft = (draft) => {
    setSchedule(s => [...s, draft]);
    setPendingDraft(null);
    const addedMsg = lang === 'zh'
      ? `已加入 — ${draft.client}, ${draft.date} ${draft.timeStart}。可在排程页编辑。`
      : lang === 'bn'
        ? `যোগ হয়েছে — ${draft.client}, ${draft.date} ${draft.timeStart}। সময়সূচী ট্যাব থেকে এডিট করুন।`
        : `Added — ${draft.client}, ${draft.date} ${draft.timeStart}. You can edit it from the schedule tab.`;
    setMessages(m => [...m, { role: 'assistant', text: addedMsg }]);
  };

  const containerStyle = isFullscreen
    ? { display: 'flex', flexDirection: 'column', height: '100%' }
    : { position: 'fixed', bottom: 80, right: 12, left: 12, maxWidth: 456, margin: '0 auto', height: '70vh', maxHeight: 600, background: C.card, borderRadius: 16, boxShadow: '0 12px 40px rgba(0,0,0,0.18)', display: 'flex', flexDirection: 'column', zIndex: 100, border: `1px solid ${C.line}` };

  return (
    <div style={containerStyle}>
      <div style={{ padding: '14px 16px', borderBottom: `1px solid ${C.line}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: '50%', background: C.accent2, color: C.accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Sparkles size={14} />
          </div>
          <div>
            <div style={{ fontFamily: F.display, fontSize: 15, color: C.ink, letterSpacing: '-0.01em' }}>Greenqubes {t.assistant}</div>
            <div style={{ fontFamily: F.body, fontSize: 10, color: C.muted, display: 'flex', alignItems: 'center', gap: 4 }}>
              <Globe size={9} /> {t.assistantSubtitle}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {!isFullscreen && onOpenFullscreen && (
            <button onClick={onOpenFullscreen} style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', padding: 4, fontFamily: F.body, fontSize: 11 }}>{t.expand}</button>
          )}
          {!isFullscreen && (
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', padding: 4 }}>
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {messages.map((m, i) => (
          <div key={i} style={{ alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
            <div style={{
              padding: '10px 14px', borderRadius: 14,
              background: m.role === 'user' ? C.ink : C.bg,
              color: m.role === 'user' ? '#fff' : C.ink,
              fontFamily: F.body, fontSize: 13, lineHeight: 1.5, whiteSpace: 'pre-wrap',
              borderBottomRightRadius: m.role === 'user' ? 4 : 14,
              borderBottomLeftRadius: m.role === 'user' ? 14 : 4,
            }}>
              {m.search && (
                <div style={{ fontSize: 10, color: C.accent, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Globe size={9} /> Web search
                </div>
              )}
              {m.text}
            </div>
            {m.draft && pendingDraft && pendingDraft.id === m.draft.id && (
              <div style={{ marginTop: 8, background: C.card, border: `1px solid ${C.accent}`, borderRadius: 12, padding: 12 }}>
                <div style={{ fontFamily: F.body, fontSize: 11, color: C.accent, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>{t.proposedEntry}</div>
                <div style={{ fontFamily: F.body, fontSize: 12, color: C.ink2, lineHeight: 1.6 }}>
                  <strong style={{ color: C.ink }}>{m.draft.client}</strong> — {m.draft.date} {m.draft.day}<br />
                  {m.draft.timeStart} – {m.draft.timeEnd}<br />
                  📍 {m.draft.location}<br />
                  👷 {m.draft.installers.map(id => STAFF.find(s => s.id === id)?.name.split(' ')[0]).join(', ')}<br />
                  💼 {t.salesPOC}: {m.draft.sales}
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                  <Btn variant="ghost" size="sm" onClick={() => { setPendingDraft(null); setMessages(mm => [...mm, { role: 'assistant', text: t.confirmDiscarded }]); }}>{t.discard}</Btn>
                  <Btn variant="accent" size="sm" icon={Check} onClick={() => confirmDraft(m.draft)}>{t.confirmAdd}</Btn>
                </div>
              </div>
            )}
          </div>
        ))}
        {thinking && (
          <div style={{ alignSelf: 'flex-start', padding: '10px 14px', background: C.bg, borderRadius: 14, fontFamily: F.body, fontSize: 13, color: C.muted, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />
            {t.thinking}
          </div>
        )}
      </div>

      <div style={{ padding: 12, borderTop: `1px solid ${C.line}`, display: 'flex', gap: 8, flexShrink: 0 }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleSend(); }}
          placeholder={t.askPlaceholder}
          style={{ flex: 1, padding: '10px 14px', border: `1px solid ${C.line}`, borderRadius: 999, fontFamily: F.body, fontSize: 13, outline: 'none', color: C.ink }}
        />
        <button onClick={handleSend} disabled={!input.trim()} style={{ width: 38, height: 38, borderRadius: '50%', background: input.trim() ? C.accent : C.line, color: '#fff', border: 'none', cursor: input.trim() ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Send size={15} />
        </button>
      </div>

      {!isFullscreen && (
        <div style={{ padding: '0 12px 10px' }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {(lang === 'zh'
              ? ['周五谁有空？', '预定 Shopee 周六安装', '滨海湾金沙装卸时间？']
              : lang === 'bn'
                ? ['শুক্রবার কে ফ্রি?', 'শনিবার Shopee ইনস্টল বুক করুন', 'MBS লোডিং বে সময়?']
                : ['Who\'s free Friday?', 'Book Shopee install Saturday', 'MBS loading bay hours?']
            ).map(s => (
              <button key={s} onClick={() => setInput(s)} style={{ background: C.bg, border: `1px solid ${C.line}`, borderRadius: 999, padding: '4px 10px', fontFamily: F.body, fontSize: 11, color: C.ink2, cursor: 'pointer' }}>{s}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ============ POLICY GATE ============
const PolicyGate = ({ onAccept, t, lang, onLangChange }) => {
  const [scrolled, setScrolled] = useState(false);
  const [needsScroll, setNeedsScroll] = useState(true);
  const scrollRef = useRef(null);

  // On mount and when language changes, check if content actually overflows.
  // If it doesn't (large screens / short policy), unlock the button immediately.
  useEffect(() => {
    const check = () => {
      const el = scrollRef.current;
      if (!el) return;
      const overflows = el.scrollHeight > el.clientHeight + 4;
      setNeedsScroll(overflows);
      if (!overflows) setScrolled(true);
    };
    check();
    // Re-check after fonts load and on resize
    const t1 = setTimeout(check, 100);
    const t2 = setTimeout(check, 600);
    window.addEventListener('resize', check);
    return () => { clearTimeout(t1); clearTimeout(t2); window.removeEventListener('resize', check); };
  }, [lang]);

  const policyTitles = { en: 'AI Usage Policy', zh: 'AI 使用政策', bn: 'AI ব্যবহার নীতি' };
  const policyHints = {
    en: needsScroll ? 'Read before continuing. Scroll to bottom to enable accept.' : 'Read before continuing.',
    zh: needsScroll ? '继续之前请阅读。滑到最底部以启用「同意」按钮。' : '继续之前请阅读。',
    bn: needsScroll ? 'চালিয়ে যাওয়ার আগে পড়ুন। গ্রহণ সক্রিয় করতে নিচে স্ক্রোল করুন।' : 'চালিয়ে যাওয়ার আগে পড়ুন।',
  };
  const ackText = {
    en: scrolled ? 'I understand — continue' : 'Scroll through to accept',
    zh: scrolled ? '我明白 — 继续' : '滑到底部以同意',
    bn: scrolled ? 'বুঝেছি — চালিয়ে যান' : 'গ্রহণ করতে স্ক্রোল করুন',
  };
  const endMark = { en: '— end of policy —', zh: '— 政策结束 —', bn: '— নীতির শেষ —' };
  const scrollDown = { en: '↓ scroll to bottom', zh: '↓ 滑到底部', bn: '↓ নিচে স্ক্রোল করুন' };

  return (
    <div style={{ background: C.bg, minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div style={{ maxWidth: 480, margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', flex: 1 }}>
        <div style={{ padding: '24px 20px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: F.body, fontSize: 11, color: C.accent, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>{t.appPhase} · First time setup</div>
            <h1 style={{ fontFamily: F.display, fontSize: 28, lineHeight: 1.1, letterSpacing: '-0.02em', color: C.ink, margin: 0 }}>{policyTitles[lang]}</h1>
            <p style={{ fontFamily: F.body, fontSize: 13, color: C.muted, marginTop: 6 }}>{policyHints[lang]}</p>
          </div>
          <select value={lang} onChange={e => onLangChange(e.target.value)}
            style={{ padding: '6px 10px', border: `1px solid ${C.line}`, borderRadius: 8, background: C.card, fontFamily: F.body, fontSize: 12, color: C.ink, cursor: 'pointer' }}>
            {LANGS.map(l => <option key={l.code} value={l.code}>{l.native}</option>)}
          </select>
        </div>
        <div ref={scrollRef}
          onScroll={(e) => { const el = e.target; if (el.scrollTop + el.clientHeight >= el.scrollHeight - 30) setScrolled(true); }}
          style={{ padding: '0 20px', overflowY: 'auto', flex: 1, marginBottom: 8 }}>

          {/* How the company brain works */}
          <Card style={{ marginBottom: 10 }}>
            <div style={{ fontFamily: F.body, fontSize: 11, color: C.accent, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
              How our company brain works
            </div>
            <div style={{ fontFamily: F.body, fontSize: 13, color: C.ink2, lineHeight: 1.65 }}>
              Greenqubes uses Claude (by Anthropic) as the reasoning engine, plus our own private vault that stores everything we do — past jobs, supplier prices, SOPs, decisions.
              <br /><br />
              <strong style={{ color: C.ink }}>Each time you ask the assistant anything,</strong> it searches our vault for relevant company knowledge and uses it to answer. The more we use it, the smarter it gets <em>about Greenqubes</em>.
              <br /><br />
              <strong style={{ color: C.good }}>Anthropic does not train on our data.</strong> Our vault is what grows — we own it, control it, edit it, delete from it. Anthropic's models stay the same.
            </div>
          </Card>

          {/* Internal vs External AI */}
          <Card style={{ marginBottom: 10 }}>
            <div style={{ fontFamily: F.body, fontSize: 13, color: C.ink2, lineHeight: 1.6 }}>
              <strong style={{ color: C.good }}>Internal Greenqubes assistant — green light.</strong> Anything work-related is fine. Project details, supplier names, proposals, costings, internal questions. It all goes into our vault, makes the brain smarter, and only Greenqubes staff can see it.
              <br /><br />
              <strong style={{ color: C.bad }}>External AI (Meta AI, ChatGPT, Gemini, etc.) — red light for company data.</strong> These services <em>do</em> train on what you paste. Information you put there can resurface in answers given to other users — including competitors. Do not paste client names, supplier prices, proposals, internal financials, or NDA-covered content into external AI.
              <br /><br />
              External AI is OK for: translating phrases, generic writing help, public info lookups, personal learning unrelated to a live project.
              <br /><br />
              <em style={{ color: C.muted }}>If unsure → use the internal assistant. That's what it's there for.</em>
            </div>
          </Card>

          {/* What happens to your conversations */}
          <Card style={{ marginBottom: 10 }}>
            <div style={{ fontFamily: F.body, fontSize: 13, color: C.ink2, lineHeight: 1.6 }}>
              <strong style={{ color: C.ink }}>What happens to your conversations:</strong>
              <br /><br />
              · <strong>Tagged work conversations</strong> are saved to the company vault, attributed to you, so anyone in Greenqubes can search them later.
              <br />
              · <strong>Untagged conversations</strong> are saved without your name, contributing to the brain anonymously.
              <br />
              · <strong>"Do not log" conversations</strong> stay out of the vault entirely — for personal or sensitive matters.
              <br /><br />
              You can mark any conversation in any of these three ways. Default is "tagged work" — change it before you send if you want privacy.
            </div>
          </Card>

          {/* Mistakes + PDPA */}
          <Card>
            <div style={{ fontFamily: F.body, fontSize: 13, color: C.ink2, lineHeight: 1.6 }}>
              <strong style={{ color: C.ink }}>If you make a mistake</strong> — accidentally paste something into external AI, or share something you shouldn't — tell your manager within 24 hours. No trouble for honest mistakes reported promptly. Trouble for hiding them.
              <br /><br />
              Under Singapore PDPA, Greenqubes is responsible for personal data even when leaked through free tools we didn't pay for. This policy protects you and the company.
            </div>
          </Card>

          {needsScroll && (
            <div style={{ height: 16, textAlign: 'center', fontFamily: F.body, fontSize: 11, color: C.muted, marginTop: 12, paddingBottom: 12 }}>
              {scrolled ? endMark[lang] : scrollDown[lang]}
            </div>
          )}
        </div>
        <div style={{ padding: '12px 20px 24px', borderTop: `1px solid ${C.line}`, background: C.card }}>
          <Btn variant="accent" full disabled={!scrolled} onClick={onAccept}>
            {ackText[lang]}
          </Btn>
        </div>
      </div>
    </div>
  );
};

// ============ LANGUAGE PICKER (dropdown trigger) ============
const LangSwitcher = ({ lang, onLangChange, t }) => {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: 'relative' }}>
      <button onClick={() => setOpen(o => !o)} style={{
        background: C.card, border: `1px solid ${C.line}`, borderRadius: 999,
        padding: '4px 10px', display: 'flex', alignItems: 'center', gap: 5,
        fontFamily: F.body, fontSize: 11, color: C.ink2, cursor: 'pointer'
      }}>
        <Languages size={12} />
        {LANGS.find(l => l.code === lang)?.native || 'EN'}
      </button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 70 }} />
          <div style={{
            position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 80,
            background: C.card, border: `1px solid ${C.line}`, borderRadius: 10,
            boxShadow: '0 8px 24px rgba(0,0,0,0.08)', minWidth: 180, padding: 6
          }}>
            <div style={{ padding: '6px 10px 4px', fontFamily: F.body, fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              {t.language} · {t.languageHint}
            </div>
            {LANGS.map(l => (
              <button key={l.code} onClick={() => { onLangChange(l.code); setOpen(false); }} style={{
                width: '100%', textAlign: 'left', background: lang === l.code ? C.accent2 : 'transparent',
                border: 'none', padding: '8px 10px', borderRadius: 6,
                fontFamily: F.body, fontSize: 13, color: C.ink, cursor: 'pointer',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center'
              }}>
                <span>{l.native}</span>
                <span style={{ fontSize: 10, color: C.muted }}>{l.label}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

// ============ ROLE SWITCHER ============
// Boss feedback #1+2: sales pushes pending → scheduler approves on a separate "link".
// In the prototype we model the two link-gated views with a role switch persisted on
// the device. In production this would be an auth-gated route (e.g. /scheduler).
const RoleSwitcher = ({ role, onRoleChange, installerId, onInstallerIdChange, t }) => {
  const [open, setOpen] = useState(false);
  const isScheduler = role === 'scheduler';
  const isInstaller = role === 'installer';
  const me = isInstaller ? STAFF.find(s => s.id === installerId) : null;
  const Icon = isScheduler ? ShieldCheck : isInstaller ? HardHat : UserCog;
  const label = isScheduler ? t.roleScheduler : isInstaller ? (me?.name.split(' ')[0] || t.roleInstaller) : t.roleSales;
  const installerStaff = STAFF.filter(s => s.role.includes('Install'));
  return (
    <div style={{ position: 'relative' }}>
      <button onClick={() => setOpen(o => !o)} style={{
        background: isScheduler ? C.ink : isInstaller ? C.good : C.card,
        color: (isScheduler || isInstaller) ? '#fff' : C.ink2,
        border: `1px solid ${isScheduler ? C.ink : isInstaller ? C.good : C.line}`, borderRadius: 999,
        padding: '4px 10px', display: 'flex', alignItems: 'center', gap: 5,
        fontFamily: F.body, fontSize: 11, cursor: 'pointer'
      }}>
        <Icon size={12} />
        {label}
      </button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 70 }} />
          <div style={{
            position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 80,
            background: C.card, border: `1px solid ${C.line}`, borderRadius: 10,
            boxShadow: '0 8px 24px rgba(0,0,0,0.08)', minWidth: 220, padding: 6
          }}>
            <div style={{ padding: '6px 10px 4px', fontFamily: F.body, fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              {t.roleSwitchHint}
            </div>
            {[
              { v: 'sales', label: t.roleSales, Icon: UserCog, sub: t.companySchedule },
              { v: 'scheduler', label: t.roleScheduler, Icon: ShieldCheck, sub: t.approvalsSubtitle },
              { v: 'installer', label: t.roleInstaller, Icon: HardHat, sub: t.installerToday },
            ].map(opt => (
              <button key={opt.v} onClick={() => { onRoleChange(opt.v); if (opt.v !== 'installer') setOpen(false); }} style={{
                width: '100%', textAlign: 'left',
                background: role === opt.v ? C.accent2 : 'transparent',
                border: 'none', padding: '8px 10px', borderRadius: 6,
                fontFamily: F.body, fontSize: 13, color: C.ink, cursor: 'pointer',
                display: 'flex', gap: 8, alignItems: 'center'
              }}>
                <opt.Icon size={14} color={role === opt.v ? C.accent : C.muted} />
                <div style={{ flex: 1 }}>
                  <div>{opt.label}</div>
                  <div style={{ fontSize: 10, color: C.muted, marginTop: 1 }}>{opt.sub}</div>
                </div>
                {role === opt.v && <Check size={14} color={C.accent} />}
              </button>
            ))}

            {/* Installer self-picker — visible when installer role active */}
            {isInstaller && (
              <>
                <div style={{ height: 1, background: C.line, margin: '6px 4px' }} />
                <div style={{ padding: '6px 10px 4px', fontFamily: F.body, fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  {t.installerSwitchSelf}
                </div>
                <div style={{ maxHeight: 220, overflowY: 'auto' }}>
                  {installerStaff.map(s => (
                    <button key={s.id} onClick={() => { onInstallerIdChange(s.id); setOpen(false); }} style={{
                      width: '100%', textAlign: 'left',
                      background: installerId === s.id ? C.goodBg : 'transparent',
                      border: 'none', padding: '6px 10px', borderRadius: 6,
                      fontFamily: F.body, fontSize: 12, color: C.ink, cursor: 'pointer',
                      display: 'flex', gap: 8, alignItems: 'center'
                    }}>
                      <div style={{
                        width: 22, height: 22, borderRadius: '50%',
                        background: installerId === s.id ? C.good : C.line,
                        color: installerId === s.id ? '#fff' : C.ink2,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 10, fontWeight: 600,
                      }}>
                        {s.name.split(' ').map(p => p[0]).join('').slice(0, 2)}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</div>
                        <div style={{ fontSize: 10, color: C.muted }}>{s.role}</div>
                      </div>
                      {installerId === s.id && <Check size={12} color={C.good} />}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
};

// ============ WORKLOAD PREVIEW MODAL ============
// Boss feedback #3: before sales pushes pending → scheduler, surface team load on
// the selected date AND nearby days so sales can renegotiate the date with client
// if the day is too packed. Tapping a nearby day switches the draft to that date.
const WorkloadPreviewModal = ({ draft, schedule, t, lang, onCancel, onSwitchDate, onConfirm }) => {
  const [pickedDate, setPickedDate] = useState(draft.date);
  const stats = dayLoadStats(schedule, draft.date, 14);
  const dates = Object.keys(stats).sort();
  const counts = dates.map(d => stats[d].total);
  const maxCount = Math.max(1, ...counts);

  const dayShort = {
    en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    zh: ['日', '一', '二', '三', '四', '五', '六'],
    bn: ['রবি', 'সোম', 'মঙ্গল', 'বুধ', 'বৃহঃ', 'শুক্র', 'শনি'],
  };
  const localeMap = { en: 'en-GB', zh: 'zh-CN', bn: 'bn-BD' };

  const targetStats = stats[pickedDate] || { total: 0, jobs: [], byInstaller: {} };
  // Per-staff load on the selected date — focused on the draft's installers
  const teamLoad = (draft.installers || []).map(id => ({
    staff: STAFF.find(s => s.id === id),
    count: targetStats.byInstaller[id] || 0,
  }));

  const loadTone = (n) => {
    if (n === 0) return { label: t.quiet, bg: C.goodBg, fg: C.good };
    if (n <= 2) return { label: t.moderate, bg: C.warnBg, fg: C.warn };
    return { label: t.busyDay, bg: C.badBg, fg: C.bad };
  };

  const proceed = () => {
    if (pickedDate !== draft.date) {
      const d = new Date(pickedDate);
      const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()];
      onSwitchDate({ ...draft, date: pickedDate, day });
    } else {
      onConfirm(draft);
    }
  };

  const pickedTone = loadTone(targetStats.total);
  const pickedDt = new Date(pickedDate);

  return (
    <div onClick={onCancel} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: C.card, borderRadius: 16, padding: 18, maxWidth: 460, width: '100%', maxHeight: '92vh', overflowY: 'auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <div style={{ width: 30, height: 30, borderRadius: '50%', background: C.accent2, color: C.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <CalendarDays size={15} />
          </div>
          <div style={{ fontFamily: F.display, fontSize: 17, color: C.ink, letterSpacing: '-0.01em' }}>
            {t.loadPreviewTitle}
          </div>
        </div>
        <div style={{ fontFamily: F.body, fontSize: 12, color: C.muted, lineHeight: 1.5, marginBottom: 14 }}>
          {t.loadPreviewIntro}
        </div>

        {/* Selected date summary */}
        <div style={{
          padding: 12, borderRadius: 10,
          background: pickedTone.bg, border: `1px solid ${pickedTone.fg}33`, marginBottom: 12
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
            <div>
              <div style={{ fontFamily: F.body, fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                {t.selectedDateLoad}
              </div>
              <div style={{ fontFamily: F.display, fontSize: 18, color: C.ink, letterSpacing: '-0.01em' }}>
                {dayShort[lang][pickedDt.getDay()]}, {pickedDt.toLocaleDateString(localeMap[lang] || 'en-GB', { day: 'numeric', month: 'short' })}
              </div>
            </div>
            <Pill tone={targetStats.total === 0 ? 'good' : targetStats.total <= 2 ? 'warn' : 'bad'}>
              {targetStats.total} {t.totalJobsThatDay} · {pickedTone.label}
            </Pill>
          </div>

          {/* Per-installer load */}
          <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${pickedTone.fg}22` }}>
            <div style={{ fontFamily: F.body, fontSize: 11, color: C.ink2, fontWeight: 500, marginBottom: 6 }}>
              {t.yourTeamThatDay}
            </div>
            {teamLoad.length === 0 ? (
              <div style={{ fontFamily: F.body, fontSize: 12, color: C.muted, fontStyle: 'italic' }}>
                — no installers picked —
              </div>
            ) : teamLoad.every(x => x.count === 0) ? (
              <div style={{ fontFamily: F.body, fontSize: 12, color: C.good }}>
                ✓ {t.noJobsForTeam}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {teamLoad.map(({ staff, count }) => staff && (
                  <div key={staff.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 8px', background: C.card, borderRadius: 6 }}>
                    <span style={{ fontFamily: F.body, fontSize: 12, color: C.ink }}>{staff.name}</span>
                    <span style={{ fontFamily: F.body, fontSize: 11, color: count === 0 ? C.muted : count >= 2 ? C.bad : C.warn, fontWeight: 500 }}>
                      {count === 0 ? `— ${t.quiet}` : `${count} ${count === 1 ? 'job' : 'jobs'}`}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Nearby dates bar chart */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontFamily: F.body, fontSize: 11, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
            {t.nearbyDates}
          </div>
          <div style={{ fontFamily: F.body, fontSize: 11, color: C.muted, marginBottom: 8 }}>
            {t.nearbyHint}
          </div>
          <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', overflowX: 'auto', padding: '0 0 4px' }}>
            {dates.map(d => {
              const s = stats[d];
              const dt = new Date(d);
              const isPicked = d === pickedDate;
              const isOriginal = d === draft.date;
              const tone = loadTone(s.total);
              const barHeight = Math.max(8, (s.total / maxCount) * 56);
              return (
                <button key={d} onClick={() => setPickedDate(d)} style={{
                  flex: '0 0 auto', minWidth: 42,
                  background: isPicked ? C.ink : 'transparent',
                  border: `1px solid ${isPicked ? C.ink : C.line}`,
                  borderRadius: 8, padding: '6px 4px',
                  cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                  fontFamily: F.body, fontSize: 10
                }}>
                  <div style={{ height: 60, display: 'flex', alignItems: 'flex-end' }}>
                    {s.total > 0 ? (
                      <div style={{
                        width: 18, height: barHeight, borderRadius: 3,
                        background: isPicked ? '#fff' : tone.fg,
                        position: 'relative'
                      }}>
                        <span style={{
                          position: 'absolute', top: -16, left: '50%', transform: 'translateX(-50%)',
                          fontSize: 10, color: isPicked ? '#fff' : C.ink, fontWeight: 600,
                        }}>{s.total}</span>
                      </div>
                    ) : (
                      <div style={{ width: 18, height: 4, background: C.line, borderRadius: 3 }} />
                    )}
                  </div>
                  <span style={{ color: isPicked ? '#fff' : C.muted, fontSize: 9, textTransform: 'uppercase' }}>
                    {dayShort[lang][dt.getDay()]}
                  </span>
                  <span style={{
                    color: isPicked ? '#fff' : (isOriginal ? C.accent : C.ink),
                    fontFamily: F.display, fontSize: 13,
                    fontWeight: isOriginal ? 600 : 400,
                  }}>
                    {dt.getDate()}
                  </span>
                  {isOriginal && !isPicked && <span style={{ width: 4, height: 4, borderRadius: '50%', background: C.accent }} />}
                </button>
              );
            })}
          </div>
        </div>

        {pickedDate !== draft.date && (
          <div style={{ marginBottom: 12, padding: '8px 10px', background: C.accent2, border: `1px dashed ${C.accent}`, borderRadius: 8, fontFamily: F.body, fontSize: 12, color: C.ink2, display: 'flex', alignItems: 'center', gap: 6 }}>
            <AlertCircle size={12} color={C.accent} />
            {t.switchedDate}
          </div>
        )}

        {/* Footer */}
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <Btn variant="ghost" full onClick={onCancel}>{t.reconsiderDate}</Btn>
          <Btn variant="accent" full icon={Send} onClick={proceed}>
            {t.sendAnyway}
          </Btn>
        </div>
      </div>
    </div>
  );
};

// ============ NOTIFICATION CENTER ============
// Boss feedback #4: alert installer + sales POC for overdue/incomplete jobs.
// Rules: scheduled jobs need completion photos to close. If timeEnd is set and now
// is past it, alert. If no timeEnd, alert at every 2-hour checkpoint and a hard
// alert at 6 PM. Scheduler can complete with photos on behalf of installer.
const NotificationCenter = ({ alerts, dismissed, onClose, onOpenJob, onDismiss, onRemind, role, t }) => {
  const [reminded, setReminded] = useState({}); // { alertId: true }
  const visible = alerts.filter(a => !dismissed.includes(a.id));

  const reasonText = (reason) => {
    if (reason === 'past_end') return t.overduePastEnd;
    if (reason === 'checkpoint_2hr') return t.checkpoint2hr;
    if (reason === 'end_of_day') return t.endOfDayMissed;
    return '';
  };

  const remind = (alert) => {
    setReminded(r => ({ ...r, [alert.id]: true }));
    onRemind(alert);
    setTimeout(() => setReminded(r => { const n = { ...r }; delete n[alert.id]; return n; }), 2200);
  };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 180, display: 'flex', justifyContent: 'flex-end' }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: '100%', maxWidth: 420, height: '100%', background: C.card,
        boxShadow: '-8px 0 24px rgba(0,0,0,0.12)', display: 'flex', flexDirection: 'column'
      }}>
        <div style={{ padding: '16px 18px', borderBottom: `1px solid ${C.line}`, display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 30, height: 30, borderRadius: '50%', background: visible.length > 0 ? C.badBg : C.goodBg, color: visible.length > 0 ? C.bad : C.good, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <BellRing size={15} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: F.display, fontSize: 16, color: C.ink, letterSpacing: '-0.01em' }}>{t.notifBell}</div>
            <div style={{ fontFamily: F.body, fontSize: 11, color: C.muted }}>{t.alertSubtitle}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted, padding: 6 }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 14 }}>
          {visible.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: C.muted }}>
              <CheckCircle2 size={32} strokeWidth={1.2} style={{ marginBottom: 12, opacity: 0.5, color: C.good }} />
              <div style={{ fontFamily: F.body, fontSize: 13 }}>{t.noAlerts}</div>
            </div>
          ) : (
            visible.map(alert => {
              const job = alert.job;
              const installerNames = job.installers.map(id => STAFF.find(s => s.id === id)?.name.split(' ')[0]).join(', ');
              const isReminded = reminded[alert.id];
              return (
                <Card key={alert.id} style={{ marginBottom: 10, border: `1px solid ${C.bad}55`, background: '#FFF7F5' }}>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                    <div style={{ flexShrink: 0, width: 28, height: 28, borderRadius: '50%', background: C.badBg, color: C.bad, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Hourglass size={13} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 6 }}>
                        <span style={{ fontFamily: F.display, fontSize: 14, color: C.ink, letterSpacing: '-0.01em' }}>
                          {job.client || t.otherBlank}
                        </span>
                        <Pill tone="bad">{t.overdueBy} {fmtOverdue(alert.overdueMins, t)}</Pill>
                      </div>
                      <div style={{ fontFamily: F.body, fontSize: 12, color: C.bad, marginTop: 2 }}>
                        {reasonText(alert.reason)}
                      </div>
                    </div>
                  </div>
                  <div style={{ fontFamily: F.body, fontSize: 12, color: C.ink2, lineHeight: 1.4, marginBottom: 8 }}>
                    {job.job}
                  </div>
                  <div style={{ display: 'flex', gap: 10, fontFamily: F.body, fontSize: 11, color: C.muted, flexWrap: 'wrap', marginBottom: 10 }}>
                    <span style={{ display: 'flex', gap: 4, alignItems: 'center' }}><Clock size={11} />{job.timeStart}{job.timeEnd ? ` – ${job.timeEnd}` : ' (open-ended)'}</span>
                    <span style={{ display: 'flex', gap: 4, alignItems: 'center' }}><User size={11} />{installerNames}</span>
                  </div>
                  <div style={{ padding: '6px 10px', background: C.card, border: `1px dashed ${alert.hasPhotos ? C.warn : C.bad}55`, borderRadius: 6, fontFamily: F.body, fontSize: 11, color: C.ink2, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <ImageIcon size={12} color={alert.hasPhotos ? C.warn : C.bad} />
                    {alert.hasPhotos ? `${t.photosUploaded} — ${t.photosRequiredToComplete}` : t.noPhotosYet}
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => onOpenJob(job)} style={{
                      flex: 1, padding: '7px 10px', borderRadius: 6,
                      border: `1px solid ${C.line}`, background: C.card, color: C.ink2,
                      fontFamily: F.body, fontSize: 12, cursor: 'pointer',
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4
                    }}>
                      <ChevronRight size={12} /> {t.editJob}
                    </button>
                    <button onClick={() => remind(alert)} disabled={isReminded} style={{
                      flex: 1, padding: '7px 10px', borderRadius: 6, border: 'none',
                      background: isReminded ? C.good : C.accent, color: '#fff',
                      fontFamily: F.body, fontSize: 12, cursor: isReminded ? 'default' : 'pointer',
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4
                    }}>
                      {isReminded ? <><Check size={12} /> {t.reminderSent}</> : <><Bell size={12} /> {t.remindNow}</>}
                    </button>
                  </div>
                  <button onClick={() => onDismiss(alert.id)} style={{
                    width: '100%', marginTop: 6, padding: '6px',
                    background: 'transparent', border: 'none', cursor: 'pointer',
                    fontFamily: F.body, fontSize: 11, color: C.muted, textDecoration: 'underline'
                  }}>
                    {t.clearAlert}
                  </button>
                </Card>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

// ============ COMPLETION MODAL ============
// Boss feedback #4.1: completing a job requires completion photos. Scheduler can
// override this requirement and may optionally attach photos themselves.
const CompletionModal = ({ job, role, t, onCancel, onComplete }) => {
  const [photos, setPhotos] = useState(job.completionPhotos || []);
  const isScheduler = role === 'scheduler';

  const addPhoto = () => {
    const id = `cp${Date.now()}`;
    const seed = Math.floor(Math.random() * 1000);
    setPhotos(p => [...p, { id, url: `https://picsum.photos/seed/${seed}/600/800`, caption: '' }]);
  };
  const removePhoto = (id) => setPhotos(p => p.filter(x => x.id !== id));

  const canComplete = isScheduler || photos.length > 0;

  return (
    <div onClick={onCancel} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 165, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: C.card, borderRadius: 16, padding: 18, maxWidth: 420, width: '100%', maxHeight: '92vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <div style={{ width: 30, height: 30, borderRadius: '50%', background: C.goodBg, color: C.good, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CheckCircle2 size={15} />
          </div>
          <div style={{ fontFamily: F.display, fontSize: 17, color: C.ink, letterSpacing: '-0.01em' }}>
            {t.completeJob}
          </div>
        </div>
        <div style={{ fontFamily: F.body, fontSize: 12, color: C.muted, marginBottom: 14 }}>
          <strong style={{ color: C.ink2 }}>{job.client || t.otherBlank}</strong> · {job.timeStart}{job.timeEnd ? ` – ${job.timeEnd}` : ''}
        </div>

        {isScheduler && (
          <div style={{ padding: '8px 10px', background: C.accent2, border: `1px solid ${C.accent}55`, borderRadius: 8, marginBottom: 12, fontFamily: F.body, fontSize: 12, color: C.ink2, display: 'flex', alignItems: 'flex-start', gap: 6 }}>
            <ShieldCheck size={13} color={C.accent} style={{ flexShrink: 0, marginTop: 2 }} />
            <div>
              <div style={{ color: C.accent, fontWeight: 500, marginBottom: 2 }}>{t.schedulerOverride}</div>
              <div>{t.schedulerCanComplete}</div>
            </div>
          </div>
        )}

        <SectionLabel>
          {isScheduler ? t.attachPhotosOptional : t.completionPhotos}
        </SectionLabel>

        {photos.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginBottom: 10 }}>
            {photos.map(p => (
              <div key={p.id} style={{ position: 'relative', aspectRatio: '1', borderRadius: 8, overflow: 'hidden', background: C.line }}>
                <img src={p.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                <button onClick={() => removePhoto(p.id)}
                  style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(0,0,0,0.65)', color: '#fff', border: 'none', borderRadius: '50%', width: 22, height: 22, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        )}

        <button onClick={addPhoto} style={{ width: '100%', padding: 12, border: `1.5px dashed ${C.line}`, borderRadius: 8, background: 'transparent', color: C.muted, fontFamily: F.body, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 12 }}>
          <Camera size={14} /> {t.addCompletionPhoto}
        </button>

        {!canComplete && (
          <div style={{ padding: '8px 10px', background: C.warnBg, border: `1px solid ${C.warn}55`, borderRadius: 8, marginBottom: 12, fontFamily: F.body, fontSize: 12, color: C.warn, display: 'flex', alignItems: 'flex-start', gap: 6 }}>
            <AlertCircle size={13} style={{ flexShrink: 0, marginTop: 2 }} />
            {t.photosRequiredToComplete}
          </div>
        )}

        {photos.length > 0 && (
          <div style={{ fontFamily: F.body, fontSize: 11, color: C.good, marginBottom: 10 }}>
            ✓ {photos.length} {t.photosUploaded}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8 }}>
          <Btn variant="ghost" full onClick={onCancel}>{t.cancel}</Btn>
          <Btn variant="accent" full icon={CheckCircle2} disabled={!canComplete} onClick={() => onComplete(photos)}>
            {t.markComplete}
          </Btn>
        </div>
      </div>
    </div>
  );
};

// ============ INSTALLER VIEW — JOB DETAIL (read-only basics, editable add-ons) ============
// Separate from JobDetail so we can lock down everything except the things installers
// genuinely need to add/update on-site: completion photos, signed DO, and the chat
// thread (text + voice notes). Every add-on fires a Telegram-style notification to
// the sales POC via the toast system.
const InstallerJobView = ({ job, schedule, setSchedule, installerId, onBack, onRequestComplete, onInstallerActivity, t, lang }) => {
  // Use the live job from schedule so changes from setSchedule reflect immediately
  const liveJob = schedule.find(j => j.id === job.id) || job;
  const me = STAFF.find(s => s.id === installerId);
  const currentUser = { role: 'installer', name: me?.name || 'Installer' };
  const isCompleted = liveJob.status === 'completed' || liveJob.completed;

  const localeMap = { en: 'en-GB', zh: 'zh-CN', bn: 'bn-BD' };
  const dateObj = new Date(liveJob.date);
  const status = fmtUntilJob(liveJob, t);

  const addCompletionPhoto = () => {
    const id = `cp${Date.now()}`;
    const seed = Math.floor(Math.random() * 1000);
    const photo = { id, url: `https://picsum.photos/seed/${seed}/600/800`, caption: '', addedBy: me?.name, addedAt: new Date().toISOString() };
    setSchedule(s => s.map(j => j.id === liveJob.id
      ? { ...j, completionPhotos: [...(j.completionPhotos || []), photo] }
      : j
    ));
    onInstallerActivity && onInstallerActivity({ kind: 'photo', salesPOC: liveJob.sales });
  };

  const setDOPhoto = () => {
    const photo = {
      url: `https://picsum.photos/seed/do${Date.now()}/400/600`,
      filename: 'signed-do.jpg',
      addedBy: me?.name,
      addedAt: new Date().toISOString(),
    };
    setSchedule(s => s.map(j => j.id === liveJob.id ? { ...j, do: true, doPhoto: photo } : j));
    onInstallerActivity && onInstallerActivity({ kind: 'do', salesPOC: liveJob.sales });
  };

  const callSales = () => {
    // In production this would dial the sales POC's phone.
    if (typeof window !== 'undefined' && window.alert) {
      window.alert(`📞  ${t.installerCallSales}: ${liveJob.sales || '—'}`);
    }
  };

  return (
    <>
      <div style={{ padding: '20px 20px 12px' }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', padding: 0, marginBottom: 8, color: C.muted, display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, fontFamily: F.body, cursor: 'pointer' }}>
          <ArrowLeft size={14} /> {t.backToSchedule}
        </button>

        {/* Status pill */}
        {status && !isCompleted && (
          <div style={{ marginBottom: 10 }}>
            <Pill tone={status.kind === 'overrun' ? 'bad' : status.kind === 'ongoing' ? 'good' : 'accent'}>
              {status.kind === 'ongoing' && <Radio size={10} style={{ marginRight: 4, verticalAlign: 'middle' }} />}
              {status.text}
            </Pill>
          </div>
        )}
        {isCompleted && (
          <div style={{ marginBottom: 10 }}>
            <Pill tone="neutral">✓ {t.completed}</Pill>
          </div>
        )}

        <h1 style={{ margin: 0, fontFamily: F.display, fontSize: 24, fontWeight: 500, color: C.ink, letterSpacing: '-0.02em' }}>
          {liveJob.client || t.otherBlank}
        </h1>
        <div style={{ fontFamily: F.body, fontSize: 13, color: C.ink2, marginTop: 4, lineHeight: 1.5 }}>
          {liveJob.job}
        </div>
      </div>

      <div style={{ padding: '0 20px 24px' }}>
        {/* The basics — read-only summary card. Big, glanceable, on-site friendly. */}
        <Card style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <Clock size={15} color={C.accent} style={{ marginTop: 2 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: F.body, fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  {dateObj.toLocaleDateString(localeMap[lang] || 'en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
                </div>
                <div style={{ fontFamily: F.display, fontSize: 18, color: C.ink, letterSpacing: '-0.01em' }}>
                  {liveJob.timeStart}{liveJob.timeEnd ? ` – ${liveJob.timeEnd}` : ''}
                </div>
              </div>
              <Pill tone={liveJob.punctuality === 'red' ? 'red' : 'blue'}>
                {liveJob.punctuality === 'red' ? t.strictOnTime : t.flexibleWindow}
              </Pill>
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <MapPin size={15} color={C.accent} style={{ marginTop: 2 }} />
              <div style={{ fontFamily: F.body, fontSize: 14, color: C.ink, lineHeight: 1.45 }}>
                {liveJob.location}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <Users size={15} color={C.accent} style={{ marginTop: 2 }} />
              <div style={{ fontFamily: F.body, fontSize: 13, color: C.ink2 }}>
                {liveJob.installers.map(id => STAFF.find(s => s.id === id)?.name).filter(Boolean).join(', ')}
              </div>
            </div>
            {liveJob.sales && (
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', paddingTop: 8, borderTop: `1px solid ${C.line}` }}>
                <UserCog size={15} color={C.accent} />
                <div style={{ flex: 1, fontFamily: F.body, fontSize: 13 }}>
                  <div style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    {t.salesPOC}
                  </div>
                  <div style={{ color: C.ink, marginTop: 1 }}>{liveJob.sales}</div>
                </div>
                <button onClick={callSales} style={{
                  background: C.good, color: '#fff', border: 'none', borderRadius: 999,
                  padding: '6px 12px', display: 'inline-flex', alignItems: 'center', gap: 5,
                  fontFamily: F.body, fontSize: 12, cursor: 'pointer',
                }}>
                  <Phone size={12} /> {t.installerCallSales}
                </button>
              </div>
            )}
          </div>
        </Card>

        {/* Files & links if any — read-only download list */}
        {((liveJob.files?.length || 0) + (liveJob.links?.length || 0)) > 0 && (
          <Card style={{ marginBottom: 12 }}>
            <SectionLabel>{t.attachment}</SectionLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
              {(liveJob.files || []).map(f => (
                <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: C.bg, borderRadius: 6 }}>
                  <FileText size={13} color={C.accent} />
                  <span style={{ fontFamily: F.body, fontSize: 12, color: C.ink, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                  <Pill tone="neutral">{f.section}</Pill>
                </div>
              ))}
              {(liveJob.links || []).map(l => (
                <a key={l.id} href={l.url} target="_blank" rel="noopener noreferrer" style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px',
                  background: C.bg, borderRadius: 6, textDecoration: 'none', color: 'inherit',
                }}>
                  <Link2 size={13} color={C.accent} />
                  <span style={{ fontFamily: F.body, fontSize: 12, color: C.ink, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {l.label || l.url}
                  </span>
                  <ExternalLink size={11} color={C.muted} />
                </a>
              ))}
            </div>
          </Card>
        )}

        {/* Post-completion edit hint banner — visible on completed jobs */}
        {isCompleted && (
          <Card style={{ marginBottom: 12, background: C.accent2, border: `1px solid ${C.accent}55` }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <History size={14} color={C.accent} style={{ marginTop: 2, flexShrink: 0 }} />
              <div style={{ fontFamily: F.body, fontSize: 12, color: C.ink2, lineHeight: 1.5 }}>
                <div style={{ color: C.accent, fontWeight: 500, marginBottom: 2, textTransform: 'uppercase', fontSize: 10, letterSpacing: '0.06em' }}>
                  {t.installerPostCompletionEdits}
                </div>
                {t.installerPostCompletionHint}
              </div>
            </div>
          </Card>
        )}

        {/* Editable: Completion photos */}
        <Card style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <SectionLabel>{t.completionPhotos}</SectionLabel>
            {(liveJob.completionPhotos || []).length > 0 && (
              <span style={{ fontFamily: F.body, fontSize: 11, color: C.good }}>
                ✓ {(liveJob.completionPhotos || []).length} {t.photoCount}
              </span>
            )}
          </div>
          {(liveJob.completionPhotos || []).length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginBottom: 10 }}>
              {liveJob.completionPhotos.map(p => (
                <div key={p.id} style={{ position: 'relative', aspectRatio: '1', borderRadius: 8, overflow: 'hidden', background: C.line }}>
                  <img src={p.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
              ))}
            </div>
          )}
          <button onClick={addCompletionPhoto} style={{
            width: '100%', padding: 12, border: `1.5px dashed ${C.line}`, borderRadius: 8,
            background: 'transparent', color: C.ink2, fontFamily: F.body, fontSize: 13, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}>
            <Camera size={14} /> {t.addCompletionPhoto}
          </button>
        </Card>

        {/* Editable: Signed DO */}
        <Card style={{ marginBottom: 12 }}>
          <SectionLabel>{t.doProof}</SectionLabel>
          {liveJob.doPhoto ? (
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: 8, background: C.bg, borderRadius: 8, marginTop: 8 }}>
              <img src={liveJob.doPhoto.url} alt="signed DO" style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 6 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: F.body, fontSize: 13, color: C.ink, fontWeight: 500 }}>{liveJob.doPhoto.filename}</div>
                <div style={{ fontFamily: F.body, fontSize: 11, color: C.muted }}>✓ {t.doTick}</div>
              </div>
            </div>
          ) : (
            <button onClick={setDOPhoto} style={{
              width: '100%', padding: 12, border: `1.5px dashed ${C.line}`, borderRadius: 8,
              background: 'transparent', color: C.ink2, fontFamily: F.body, fontSize: 13, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 8,
            }}>
              <FileSignature size={14} /> {t.uploadDOPhoto}
            </button>
          )}
        </Card>

        {/* Live chat thread — installer + sales + scheduler */}
        <JobChatThread
          job={liveJob}
          schedule={schedule}
          setSchedule={setSchedule}
          currentUser={currentUser}
          t={t}
          onInstallerActivity={onInstallerActivity}
        />

        {/* Mark complete button — only on active jobs */}
        {!isCompleted && (
          <div style={{ marginTop: 16 }}>
            <Btn variant="accent" full icon={CheckCircle2} onClick={() => onRequestComplete(liveJob)}>
              {t.completeJob}
            </Btn>
          </div>
        )}
      </div>
    </>
  );
};

// ============ INSTALLER HOME — TODAY + UPCOMING ============
// At-a-glance dashboard for the busy on-site installer. Big "Now" card pinned to the
// top, "Up next" + remaining today, and a collapsed "this week" list below.
const InstallerHomeTab = ({ schedule, installerId, onJobClick, t, lang }) => {
  const me = STAFF.find(s => s.id === installerId);
  const todayStr = MOCK_TODAY_STR;
  const localeMap = { en: 'en-GB', zh: 'zh-CN', bn: 'bn-BD' };

  // All non-completed jobs assigned to me, sorted by date+time
  const myActive = schedule
    .filter(j => j.installers?.includes(installerId))
    .filter(j => j.status !== 'completed' && !j.completed)
    .filter(j => j.status !== 'pending' && j.status !== 'awaiting_approval')
    .sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return (timeToMinutes(a.timeStart) ?? 0) - (timeToMinutes(b.timeStart) ?? 0);
    });

  const todayJobs = myActive.filter(j => j.date === todayStr);
  const futureJobs = myActive.filter(j => j.date > todayStr);

  const nowMins = MOCK_NOW.getHours() * 60 + MOCK_NOW.getMinutes();
  // Current job: started but not yet past 1h grace from end (or no end given → started today)
  const currentJob = todayJobs.find(j => {
    const s = timeToMinutes(j.timeStart);
    if (s === null || s > nowMins) return false;
    const e = j.timeEnd ? timeToMinutes(j.timeEnd) : s + 480;
    return nowMins <= e + 60; // 1h grace
  });
  const remainingToday = todayJobs.filter(j => j !== currentJob);
  const upNext = remainingToday[0] || futureJobs[0];
  const restThisWeek = futureJobs
    .filter(j => j !== upNext)
    .filter(j => {
      const d = new Date(j.date), today = new Date(todayStr);
      const diff = Math.floor((d - today) / (1000 * 60 * 60 * 24));
      return diff <= 7;
    });

  const renderBigCard = (job, label, accent = false) => {
    if (!job) return null;
    const dateObj = new Date(job.date);
    const status = fmtUntilJob(job, t);
    const installerNames = job.installers.map(id => STAFF.find(s => s.id === id)?.name.split(' ')[0]).join(', ');
    return (
      <Card onClick={() => onJobClick(job)} style={{
        marginBottom: 10, padding: 16,
        border: accent ? `2px solid ${C.good}` : `1px solid ${C.line}`,
        background: accent ? C.goodBg : C.card,
        cursor: 'pointer',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '3px 9px', borderRadius: 999,
            background: accent ? C.good : C.line,
            color: accent ? '#fff' : C.ink2,
            fontFamily: F.body, fontSize: 10, fontWeight: 600,
            textTransform: 'uppercase', letterSpacing: '0.08em',
          }}>
            {accent && <Radio size={10} />}
            {label}
          </div>
          {status && (
            <span style={{
              fontFamily: F.body, fontSize: 11, fontWeight: 500,
              color: status.kind === 'overrun' ? C.bad : status.kind === 'ongoing' ? C.good : C.ink2,
            }}>
              {status.text}
            </span>
          )}
        </div>
        <div style={{ fontFamily: F.display, fontSize: 22, color: C.ink, letterSpacing: '-0.02em', lineHeight: 1.15, marginBottom: 4 }}>
          {job.client || t.otherBlank}
        </div>
        <div style={{ fontFamily: F.body, fontSize: 13, color: C.ink2, lineHeight: 1.45, marginBottom: 10 }}>
          {job.job}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5, fontFamily: F.body, fontSize: 12, color: C.ink2 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Clock size={12} color={C.muted} />
            <span style={{ fontWeight: 500 }}>{job.timeStart}{job.timeEnd ? ` – ${job.timeEnd}` : ''}</span>
            <span style={{ color: C.muted }}>· {dateObj.toLocaleDateString(localeMap[lang] || 'en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <MapPin size={12} color={C.muted} />
            <span>{job.location}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Users size={12} color={C.muted} />
            <span>{installerNames}</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
          {job.production && <Pill tone="good">{t.productionTick}</Pill>}
          {job.do && <Pill>{t.doTick}</Pill>}
          {(job.installerMessages?.length || 0) > 0 && (
            <Pill tone="accent">
              <MessageCircle size={9} style={{ marginRight: 3, verticalAlign: '-1px' }} />
              {job.installerMessages.length}
            </Pill>
          )}
          {(job.completionPhotos?.length || 0) > 0 && (
            <Pill tone="good">📸 {job.completionPhotos.length}</Pill>
          )}
        </div>
      </Card>
    );
  };

  return (
    <>
      <div style={{ padding: '20px 20px 12px' }}>
        <div style={{ fontFamily: F.body, fontSize: 11, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
          {t.installerHi}, {me?.name.split(' ')[0]}
        </div>
        <h1 style={{ margin: 0, fontFamily: F.display, fontSize: 26, fontWeight: 500, color: C.ink, letterSpacing: '-0.02em' }}>
          {t.installerToday}
        </h1>
        <div style={{ fontFamily: F.body, fontSize: 12, color: C.muted, marginTop: 4 }}>
          {myActive.length} {t.installerJobsAssignedCount} ·  {todayJobs.length} {t.filterToday.toLowerCase()}
        </div>
      </div>

      <div style={{ padding: '0 20px 24px' }}>
        {/* Now */}
        {currentJob ? (
          renderBigCard(currentJob, t.installerNowLabel, true)
        ) : todayJobs.length > 0 ? (
          renderBigCard(todayJobs[0], t.installerNowLabel, true)
        ) : (
          <Card style={{ textAlign: 'center', padding: 32, color: C.muted, marginBottom: 10 }}>
            <Briefcase size={28} strokeWidth={1.2} style={{ marginBottom: 10, opacity: 0.5 }} />
            <div style={{ fontFamily: F.display, fontSize: 16, color: C.ink, marginBottom: 4 }}>
              {t.installerNothingToday}
            </div>
            <div style={{ fontFamily: F.body, fontSize: 12 }}>{t.installerRestDay}</div>
          </Card>
        )}

        {/* Up next */}
        {upNext && upNext !== currentJob && renderBigCard(upNext, t.installerUpNext, false)}

        {/* Rest of today */}
        {remainingToday.filter(j => j !== upNext).length > 0 && (
          <>
            <div style={{ fontFamily: F.body, fontSize: 11, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '14px 0 8px' }}>
              {t.installerLaterToday}
            </div>
            {remainingToday.filter(j => j !== upNext).map(job => (
              <ScheduleRow key={job.id} job={job} onClick={() => onJobClick(job)} t={t} />
            ))}
          </>
        )}

        {/* This week */}
        {restThisWeek.length > 0 && (
          <>
            <div style={{ fontFamily: F.body, fontSize: 11, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '14px 0 8px' }}>
              {t.installerThisWeek}
            </div>
            {restThisWeek.map(job => (
              <ScheduleRow key={job.id} job={job} onClick={() => onJobClick(job)} t={t} />
            ))}
          </>
        )}

        {/* Empty when nothing upcoming and nothing today */}
        {!currentJob && todayJobs.length === 0 && futureJobs.length === 0 && (
          <div style={{ fontFamily: F.body, fontSize: 12, color: C.muted, fontStyle: 'italic', textAlign: 'center', padding: '14px 0' }}>
            {t.installerNothingUpcoming}
          </div>
        )}
      </div>
    </>
  );
};

// ============ INSTALLER HISTORY — PAST JOBS ============
// Lets installer reopen completed jobs to attach DO retroactively, add extra photos,
// drop a comment, or send a voice note. Each addition fires a Telegram-style toast
// to the sales POC.
const InstallerHistoryTab = ({ schedule, installerId, onJobClick, t, lang }) => {
  const localeMap = { en: 'en-GB', zh: 'zh-CN', bn: 'bn-BD' };
  const past = schedule
    .filter(j => j.installers?.includes(installerId))
    .filter(j => j.status === 'completed' || j.completed)
    .sort((a, b) => (b.completedAt || b.date).localeCompare(a.completedAt || a.date));

  return (
    <>
      <div style={{ padding: '20px 20px 12px' }}>
        <div style={{ fontFamily: F.body, fontSize: 11, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
          {t.installerHistorySubtitle}
        </div>
        <h1 style={{ margin: 0, fontFamily: F.display, fontSize: 26, fontWeight: 500, color: C.ink, letterSpacing: '-0.02em' }}>
          {t.installerHistoryTitle}
        </h1>
      </div>

      <div style={{ padding: '0 20px 24px' }}>
        {past.length === 0 ? (
          <Card style={{ textAlign: 'center', padding: 40, color: C.muted }}>
            <Archive size={28} strokeWidth={1.2} style={{ marginBottom: 10, opacity: 0.5 }} />
            <div style={{ fontFamily: F.body, fontSize: 13 }}>{t.installerNoHistory}</div>
          </Card>
        ) : (
          past.map(job => {
            const dateObj = new Date(job.date);
            const completed = job.completedAt ? new Date(job.completedAt) : null;
            const installerNames = job.installers.map(id => STAFF.find(s => s.id === id)?.name.split(' ')[0]).join(', ');
            const hasDO = !!job.doPhoto;
            const photoCount = (job.completionPhotos?.length || 0);
            const messageCount = (job.installerMessages?.length || 0);
            return (
              <Card key={job.id} onClick={() => onJobClick(job)} style={{ marginBottom: 8, cursor: 'pointer' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                  <span style={{ fontFamily: F.display, fontSize: 16, color: C.ink, letterSpacing: '-0.01em' }}>
                    {job.client || t.otherBlank}
                  </span>
                  <span style={{ fontFamily: F.body, fontSize: 11, color: C.muted }}>
                    {dateObj.toLocaleDateString(localeMap[lang] || 'en-GB', { day: 'numeric', month: 'short' })}
                  </span>
                </div>
                <div style={{ fontFamily: F.body, fontSize: 12, color: C.ink2, lineHeight: 1.45, marginBottom: 6 }}>
                  {job.job}
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontFamily: F.body, fontSize: 11, color: C.muted, flexWrap: 'wrap' }}>
                  <span style={{ display: 'flex', gap: 4, alignItems: 'center' }}><MapPin size={11} />{job.location.length > 24 ? job.location.slice(0, 24) + '…' : job.location}</span>
                  <span style={{ display: 'flex', gap: 4, alignItems: 'center' }}><User size={11} />{installerNames}</span>
                  <Pill tone="neutral">✓ {t.completed}</Pill>
                  {hasDO ? <Pill tone="good">{t.doTick}</Pill> : <Pill tone="warn">⚠ no DO</Pill>}
                  {photoCount > 0 && <Pill tone="good">📸 {photoCount}</Pill>}
                  {messageCount > 0 && (
                    <Pill tone="accent">
                      <MessageCircle size={9} style={{ marginRight: 3, verticalAlign: '-1px' }} />
                      {messageCount}
                    </Pill>
                  )}
                </div>
              </Card>
            );
          })
        )}
      </div>
    </>
  );
};

// ============ MAIN APP ============
export default function StudioOps() {
  const [lang, setLang] = useState(() => {
    const stored = storage.get('studioOps.lang');
    return (stored && LANGS.find(l => l.code === stored)) ? stored : 'en';
  });
  const t = T[lang] || T.en;

  const [accepted, setAccepted] = useState(() => storage.get('studioOps.policy.accepted') === '1');
  const [tab, setTab] = useState('schedule');
  const [schedule, setSchedule] = useState(INITIAL_SCHEDULE);
  const [editingJob, setEditingJob] = useState(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [toast, setToast] = useState(null); // { phase: 'sending'|'sent', count, total }

  // Boss feedback #1: role determines which "link" the user is on. Now supports a
  // third "installer" role with its own dedicated tabs (Today / Past / Assistant)
  // and a streamlined job view for on-site updates.
  const [role, setRole] = useState(() => {
    const stored = storage.get('studioOps.role');
    return (stored === 'sales' || stored === 'scheduler' || stored === 'installer') ? stored : 'sales';
  });
  // Which installer is signed in (only meaningful when role === 'installer')
  const [installerId, setInstallerId] = useState(() => {
    const stored = storage.get('studioOps.installerId');
    const num = Number(stored);
    return STAFF.find(s => s.id === num && s.role.includes('Install')) ? num : 1;
  });
  const handleRoleChange = (newRole) => {
    setRole(newRole);
    storage.set('studioOps.role', newRole);
    setEditingJob(null);
    // Reset to a tab that exists for this role
    if (newRole === 'installer') setTab('myJobs');
    else setTab('schedule');
  };
  const handleInstallerIdChange = (newId) => {
    setInstallerId(newId);
    storage.set('studioOps.installerId', String(newId));
    setEditingJob(null);
  };

  // Toast helper for installer add-on notifications. Triggers the same Telegram-style
  // overlay used by handleSaveJob/handleRemindAlert so the entire app's notification
  // pattern stays consistent.
  const notifyInstallerActivity = ({ kind, salesPOC }) => {
    if (!salesPOC) return;
    setToast({ phase: 'sending', count: 1, total: 1, kind });
    setTimeout(() => setToast({ phase: 'sent', count: 1, total: 1, kind, salesPOC }), 1200);
    setTimeout(() => setToast(null), 4000);
  };

  // Boss feedback #3: workload preview before sales send pending → scheduler.
  // pendingPush holds the draft that's waiting for the workload review.
  const [pendingPush, setPendingPush] = useState(null);

  // Boss feedback #4: alerts panel + dismissed alert ids.
  const [notifsOpen, setNotifsOpen] = useState(false);
  const [dismissedAlerts, setDismissedAlerts] = useState([]);

  // Boss feedback #4.1: completion modal that requires photos (or scheduler override).
  const [completingJob, setCompletingJob] = useState(null);

  // Clients + sales are stateful so users can add new
  const [clients, setClients] = useState(CLIENTS);
  const [sales, setSales] = useState(SALES_TEAM);
  // Per-client list of contact people: { 'Uniqlo SG': [{name, phone, role}, ...] }
  const [clientContacts, setClientContacts] = useState(INITIAL_CLIENT_CONTACTS);
  const addClient = (name) => {
    setClients(c => c.includes(name) ? c : [...c, name]);
    setClientContacts(cc => cc[name] ? cc : { ...cc, [name]: [] });
  };
  const addSales = (name) => setSales(s => s.includes(name) ? s : [...s, name]);
  const addClientContact = (clientName, contact) => {
    setClientContacts(cc => ({
      ...cc,
      [clientName]: [...(cc[clientName] || []).filter(c => c.name !== contact.name), contact]
    }));
  };
  const updateContactPhone = (clientName, contactName, phone) => {
    setClientContacts(cc => ({
      ...cc,
      [clientName]: (cc[clientName] || []).map(c => c.name === contactName ? { ...c, phone } : c)
    }));
  };
  const updateContactRole = (clientName, contactName, role) => {
    setClientContacts(cc => ({
      ...cc,
      [clientName]: (cc[clientName] || []).map(c => c.name === contactName ? { ...c, role } : c)
    }));
  };

  // View mode preference persisted locally
  const [viewMode, setViewMode] = useState(() => {
    const stored = storage.get('studioOps.viewMode');
    return ['list', 'week', 'month'].includes(stored) ? stored : 'list';
  });
  const handleSetViewMode = (m) => { setViewMode(m); storage.set('studioOps.viewMode', m); };

  const handleLangChange = (newLang) => {
    setLang(newLang);
    storage.set('studioOps.lang', newLang);
  };
  const handleAccept = () => {
    setAccepted(true);
    storage.set('studioOps.policy.accepted', '1');
  };

  useEffect(() => {
    const link = document.createElement('link');
    link.href = 'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=IBM+Plex+Sans:wght@400;500;600&family=Noto+Sans+Bengali:wght@400;500;600&family=Noto+Sans+SC:wght@400;500;600&display=swap';
    link.rel = 'stylesheet';
    document.head.appendChild(link);
    const style = document.createElement('style');
    style.textContent = `@keyframes spin { to { transform: rotate(360deg); } }
      @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
      :lang(zh), [lang="zh"] { font-family: 'Noto Sans SC', 'IBM Plex Sans', sans-serif; }
      :lang(bn), [lang="bn"] { font-family: 'Noto Sans Bengali', 'IBM Plex Sans', sans-serif; }`;
    document.head.appendChild(style);
  }, []);

  if (!accepted) return <PolicyGate onAccept={handleAccept} t={t} lang={lang} onLangChange={handleLangChange} />;

  const tabs = role === 'scheduler'
    ? [
        { id: 'schedule', label: t.schedule, Icon: Calendar },
        { id: 'pending', label: t.pendingTab, Icon: ClipboardList },
        { id: 'approvals', label: t.approvalsTab, Icon: Inbox },
        { id: 'completed', label: t.completedTab, Icon: Archive },
        { id: 'chat', label: t.assistant, Icon: MessageSquare },
      ]
    : role === 'installer'
    ? [
        { id: 'myJobs', label: t.installerMyJobsTab, Icon: HardHat },
        { id: 'history', label: t.installerHistoryTab, Icon: History },
        { id: 'chat', label: t.assistant, Icon: MessageSquare },
      ]
    : [
        { id: 'schedule', label: t.schedule, Icon: Calendar },
        { id: 'pending', label: t.pendingTab, Icon: ClipboardList },
        { id: 'completed', label: t.completedTab, Icon: Archive },
        { id: 'chat', label: t.assistant, Icon: MessageSquare },
      ];

  const handleSaveJob = (draft, requestNotify = false) => {
    const existing = schedule.find(j => j.id === draft.id);
    const isUpdate = !!existing;

    let shouldNotify = requestNotify && !isUpdate;
    // Don't notify for pending entries — they're not confirmed
    if (draft.status === 'pending') shouldNotify = false;

    if (requestNotify && isUpdate && draft.status !== 'pending') {
      const oldAttachCount = (existing.files?.length || 0) + (existing.links?.length || 0);
      const newAttachCount = (draft.files?.length || 0) + (draft.links?.length || 0);
      const changed =
        existing.timeStart !== draft.timeStart ||
        existing.timeEnd !== draft.timeEnd ||
        existing.location !== draft.location ||
        JSON.stringify(existing.installers) !== JSON.stringify(draft.installers) ||
        oldAttachCount !== newAttachCount;
      shouldNotify = changed;
    }

    setSchedule(s => {
      const idx = s.findIndex(j => j.id === draft.id);
      if (idx >= 0) { const next = [...s]; next[idx] = draft; return next; }
      return [...s, draft];
    });
    setEditingJob(null);

    if (shouldNotify) {
      const enrolledCount = draft.installers.filter(id => STAFF.find(s => s.id === id)?.tgEnrolled).length;
      const total = draft.installers.length + (draft.sales ? 1 : 0);
      const sent = enrolledCount + (draft.sales ? 1 : 0);
      setToast({ phase: 'sending', count: sent, total });
      setTimeout(() => setToast({ phase: 'sent', count: sent, total }), 1400);
      setTimeout(() => setToast(null), 4200);
    }
  };

  const handlePushToSchedule = (draft, requestNotify = true) => {
    if (role === 'sales') {
      // Sales path: open workload preview popup. From there, sales either cancels,
      // switches the date, or confirms — confirmation routes the job to awaiting_approval.
      setPendingPush({ draft, requestNotify });
      return;
    }
    // Scheduler path: directly schedule (carbon-copy of original behaviour)
    handleSaveJob({ ...draft, status: 'scheduled' }, requestNotify);
    setTab('schedule');
  };

  // Sales confirmed the workload review → send job to scheduler queue.
  const handleConfirmSendToScheduler = (draft) => {
    const stamped = {
      ...draft,
      status: 'awaiting_approval',
      submittedForApprovalAt: new Date().toISOString(),
      submittedBy: draft.sales || '—',
    };
    setSchedule(s => {
      const idx = s.findIndex(j => j.id === stamped.id);
      if (idx >= 0) { const next = [...s]; next[idx] = stamped; return next; }
      return [...s, stamped];
    });
    setEditingJob(null);
    setPendingPush(null);
    setTab('pending'); // sales sees their submission in pending tab with "sent for approval" badge
  };

  // Scheduler approves an awaiting-approval job → becomes scheduled and notifies team.
  const handleApprove = (draft, requestNotify = true) => {
    const finalDraft = {
      ...draft,
      status: 'scheduled',
      approvedAt: new Date().toISOString(),
    };
    handleSaveJob(finalDraft, requestNotify);
    setTab('approvals');
  };

  // Either side can send an awaiting-approval back to pending so sales can edit it.
  const handleSendBack = (id) => {
    setSchedule(s => s.map(j => j.id === id
      ? { ...j, status: 'pending', submittedForApprovalAt: null, submittedBy: null }
      : j
    ));
    setEditingJob(null);
  };

  const handleDeleteJob = (id) => {
    setSchedule(s => s.filter(j => j.id !== id));
    setEditingJob(null);
  };

  // Triggered by JobDetail's "Mark complete" button — opens CompletionModal which
  // enforces the completion-photo requirement (scheduler can override).
  const handleRequestComplete = (job) => {
    setCompletingJob(job);
  };

  // Completion confirmed — save photos and mark done.
  const handleCompleteWithPhotos = (photos) => {
    if (!completingJob) return;
    setSchedule(s => s.map(j => j.id === completingJob.id ? {
      ...j,
      status: 'completed',
      completed: true,
      completedAt: new Date().toISOString(),
      completionPhotos: [...(j.completionPhotos || []), ...photos.filter(p => !(j.completionPhotos || []).find(x => x.id === p.id))],
    } : j));
    // Dismiss any alert for this job
    setDismissedAlerts(d => [...d, `alert-${completingJob.id}`]);
    setCompletingJob(null);
    setEditingJob(null);
  };

  const handleCompleteJob = (id) => {
    // Legacy direct-complete (still used by ChatPanel / other entry points if any)
    setSchedule(s => s.map(j => j.id === id ? { ...j, status: 'completed', completed: true, completedAt: new Date().toISOString() } : j));
    setEditingJob(null);
  };

  const handleRestoreJob = (id) => {
    setSchedule(s => s.map(j => j.id === id ? { ...j, status: 'scheduled', completed: false, completedAt: null } : j));
    setEditingJob(null);
  };

  // Mock "send reminder" — in production this fires Telegram messages to installer + sales POC.
  const handleRemindAlert = (alert) => {
    const installerCount = alert.job.installers.length;
    const total = installerCount + (alert.job.sales ? 1 : 0);
    setToast({ phase: 'sending', count: total, total });
    setTimeout(() => setToast({ phase: 'sent', count: total, total }), 1400);
    setTimeout(() => setToast(null), 4200);
  };

  const showFloatingChat = tab !== 'chat' && !editingJob && role !== 'installer';
  const activeSchedule = schedule.filter(j => j.status === 'scheduled' || (!j.status && !j.completed));
  // Pending tab shows pending + (for sales) their own awaiting_approval submissions
  const pendingSchedule = schedule.filter(j => j.status === 'pending' || j.status === 'awaiting_approval');
  const approvalsSchedule = schedule.filter(j => j.status === 'awaiting_approval');
  const completedSchedule = schedule.filter(j => j.status === 'completed' || j.completed);
  // For clash detection, expose scheduled + pending + awaiting so soft clashes work
  const scheduleForClashCheck = [...activeSchedule, ...pendingSchedule];

  // Compute overdue alerts live from the schedule
  const allAlerts = detectOverdue(schedule);
  const visibleAlerts = allAlerts.filter(a => !dismissedAlerts.includes(a.id));
  const overdueIds = visibleAlerts.map(a => a.jobId);

  return (
    <div lang={lang} style={{ background: C.bg, minHeight: '100vh', fontFamily: F.body, color: C.ink, paddingBottom: 80 }}>
      <div style={{ maxWidth: 480, margin: '0 auto', position: 'relative', minHeight: '100vh' }}>
        <div style={{ padding: '14px 20px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <div style={{ fontFamily: F.display, fontSize: 14, color: C.ink, letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 500 }}>
            Green<span style={{ color: C.accent }}>·</span>qubes
            <span style={{ marginLeft: 8, fontSize: 9, background: C.accent2, color: C.accent, padding: '2px 6px', borderRadius: 4, letterSpacing: '0.04em' }}>{t.appPhase}</span>
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {/* Boss feedback #4: alerts bell — visible to everyone, badged with unread count */}
            <button onClick={() => setNotifsOpen(true)} style={{
              position: 'relative', background: visibleAlerts.length > 0 ? C.bad : C.card,
              border: `1px solid ${visibleAlerts.length > 0 ? C.bad : C.line}`,
              color: visibleAlerts.length > 0 ? '#fff' : C.ink2,
              borderRadius: 999, padding: '5px 9px',
              display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer',
              fontFamily: F.body, fontSize: 11
            }}>
              {visibleAlerts.length > 0 ? <BellRing size={12} /> : <Bell size={12} />}
              {visibleAlerts.length > 0 && (
                <span style={{ fontWeight: 600 }}>{visibleAlerts.length}</span>
              )}
            </button>
            <RoleSwitcher role={role} onRoleChange={handleRoleChange} installerId={installerId} onInstallerIdChange={handleInstallerIdChange} t={t} />
            <LangSwitcher lang={lang} onLangChange={handleLangChange} t={t} />
          </div>
        </div>

        {tab === 'schedule' && !editingJob && (
          <ScheduleTab
            schedule={activeSchedule}
            onJobClick={setEditingJob}
            onNewJob={() => setEditingJob({ id: null })}
            t={t}
            lang={lang}
            viewMode={viewMode}
            setViewMode={handleSetViewMode}
            isCompletedView={false}
            overdueIds={overdueIds}
          />
        )}

        {tab === 'pending' && !editingJob && (
          <ScheduleTab
            schedule={pendingSchedule}
            onJobClick={(j) => setEditingJob(j)}
            onNewJob={() => setEditingJob({ id: null, _isNewPending: true })}
            t={t}
            lang={lang}
            viewMode={viewMode}
            setViewMode={handleSetViewMode}
            isCompletedView={false}
            isPendingView={true}
          />
        )}

        {tab === 'approvals' && !editingJob && role === 'scheduler' && (
          <ScheduleTab
            schedule={approvalsSchedule}
            onJobClick={(j) => setEditingJob(j)}
            onNewJob={null}
            t={t}
            lang={lang}
            viewMode={viewMode}
            setViewMode={handleSetViewMode}
            isCompletedView={false}
            isApprovalsView={true}
          />
        )}

        {tab === 'completed' && !editingJob && (
          <ScheduleTab
            schedule={completedSchedule}
            onJobClick={setEditingJob}
            onNewJob={null}
            t={t}
            lang={lang}
            viewMode={viewMode}
            setViewMode={handleSetViewMode}
            isCompletedView={true}
          />
        )}

        {/* Installer dashboard — current + upcoming jobs assigned to me */}
        {tab === 'myJobs' && !editingJob && role === 'installer' && (
          <InstallerHomeTab
            schedule={schedule}
            installerId={installerId}
            onJobClick={setEditingJob}
            t={t}
            lang={lang}
          />
        )}

        {/* Installer history — past jobs (still attachable for retroactive uploads) */}
        {tab === 'history' && !editingJob && role === 'installer' && (
          <InstallerHistoryTab
            schedule={schedule}
            installerId={installerId}
            onJobClick={setEditingJob}
            t={t}
            lang={lang}
          />
        )}

        {/* Installer job view — streamlined, read-only basics + editable add-ons */}
        {editingJob && role === 'installer' && (
          <InstallerJobView
            key={editingJob.id || 'inst-job'}
            job={editingJob}
            schedule={schedule}
            setSchedule={setSchedule}
            installerId={installerId}
            onBack={() => setEditingJob(null)}
            onRequestComplete={handleRequestComplete}
            onInstallerActivity={notifyInstallerActivity}
            t={t}
            lang={lang}
          />
        )}

        {editingJob && role !== 'installer' && (
          <JobDetail
            key={editingJob.id || 'new'}
            job={editingJob.id ? editingJob : null}
            schedule={scheduleForClashCheck}
            fullSchedule={schedule}
            setSchedule={setSchedule}
            onBack={() => setEditingJob(null)}
            onSave={handleSaveJob}
            onDelete={handleDeleteJob}
            onComplete={handleCompleteJob}
            onRestore={handleRestoreJob}
            onPushToSchedule={handlePushToSchedule}
            onApprove={handleApprove}
            onSendBack={handleSendBack}
            onRequestComplete={handleRequestComplete}
            onInstallerActivity={notifyInstallerActivity}
            t={t}
            clients={clients}
            sales={sales}
            addClient={addClient}
            addSales={addSales}
            clientContacts={clientContacts}
            addClientContact={addClientContact}
            updateContactPhone={updateContactPhone}
            updateContactRole={updateContactRole}
            readOnly={tab === 'completed'}
            isPendingMode={
              (tab === 'pending' && editingJob?.status !== 'awaiting_approval') ||
              (tab === 'approvals' && editingJob?.status !== 'awaiting_approval') ||
              editingJob?._isNewPending ||
              editingJob?.status === 'pending'
            }
            role={role}
          />
        )}

        {tab === 'chat' && (
          <div style={{ height: 'calc(100vh - 64px - 80px)', display: 'flex', flexDirection: 'column' }}>
            <ChatPanel schedule={schedule} setSchedule={setSchedule} isFullscreen={true} onClose={() => {}} t={t} lang={lang} />
          </div>
        )}

        {chatOpen && tab !== 'chat' && (
          <ChatPanel
            schedule={schedule}
            setSchedule={setSchedule}
            onClose={() => setChatOpen(false)}
            isFullscreen={false}
            onOpenFullscreen={() => { setChatOpen(false); setTab('chat'); }}
            t={t}
            lang={lang}
          />
        )}

        {showFloatingChat && !chatOpen && (
          <button onClick={() => setChatOpen(true)} style={{
            position: 'fixed', bottom: 96, right: 16, width: 52, height: 52, borderRadius: '50%',
            background: C.accent, color: '#fff', border: 'none', cursor: 'pointer',
            boxShadow: '0 6px 20px rgba(181,82,61,0.35)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60,
          }}>
            <Sparkles size={20} />
          </button>
        )}

        {/* Workload preview modal — sales sees this before pushing to scheduler */}
        {pendingPush && (
          <WorkloadPreviewModal
            draft={pendingPush.draft}
            schedule={schedule}
            t={t}
            lang={lang}
            onCancel={() => setPendingPush(null)}
            onSwitchDate={(updatedDraft) => setPendingPush({ ...pendingPush, draft: updatedDraft })}
            onConfirm={(finalDraft) => {
              handleConfirmSendToScheduler(finalDraft);
              setPendingPush(null);
            }}
          />
        )}

        {/* Notification drawer — overdue / uncompleted job alerts */}
        {notifsOpen && (
          <NotificationCenter
            alerts={visibleAlerts}
            dismissed={dismissedAlerts}
            onClose={() => setNotifsOpen(false)}
            onOpenJob={(job) => {
              setNotifsOpen(false);
              setEditingJob(job);
            }}
            onDismiss={(alertId) => setDismissedAlerts(d => [...d, alertId])}
            onRemind={handleRemindAlert}
            role={role}
            t={t}
          />
        )}

        {/* Completion modal — enforces photo upload (with scheduler override) */}
        {completingJob && (
          <CompletionModal
            job={completingJob}
            role={role}
            t={t}
            onCancel={() => setCompletingJob(null)}
            onComplete={handleCompleteWithPhotos}
          />
        )}

        {/* Notification toast */}
        {toast && (
          <div style={{
            position: 'fixed', bottom: 90, left: 16, right: 16, maxWidth: 448, margin: '0 auto',
            background: toast.phase === 'sent' ? C.ink : C.card,
            color: toast.phase === 'sent' ? '#fff' : C.ink,
            border: toast.phase === 'sending' ? `1px solid ${C.line}` : 'none',
            borderRadius: 12, padding: '12px 16px', zIndex: 70,
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
            display: 'flex', alignItems: 'center', gap: 10,
            fontFamily: F.body, fontSize: 13,
          }}>
            {toast.phase === 'sending' ? (
              <>
                <Loader2 size={15} color={C.accent} style={{ animation: 'spin 1s linear infinite' }} />
                <span>{t.notifyingNow}</span>
              </>
            ) : toast.kind ? (
              // Installer-activity toast — personalised with what was sent + sales POC name
              <>
                {toast.kind === 'voice' && <Mic size={14} />}
                {toast.kind === 'comment' && <MessageCircle size={14} />}
                {toast.kind === 'photo' && <Camera size={14} />}
                {toast.kind === 'do' && <FileSignature size={14} />}
                <span>
                  {toast.kind === 'voice' && t.jobChatVoice}
                  {toast.kind === 'comment' && t.jobChatComment}
                  {toast.kind === 'photo' && t.jobChatPhotoAdded}
                  {toast.kind === 'do' && t.jobChatDOAdded}
                  {' · '}
                  {toast.salesPOC ? `${toast.salesPOC} ${t.jobChatNotifiedSales.toLowerCase()}` : t.jobChatNotifiedSales}
                  {' · '}
                  <span style={{ opacity: 0.75 }}>{t.viaTelegram}</span>
                </span>
              </>
            ) : (
              <>
                <Send size={14} />
                <span>{t.notifiedSuccess} {toast.count}/{toast.total} · {t.viaTelegram}</span>
                {toast.count < toast.total && <span style={{ marginLeft: 'auto', opacity: 0.7, fontSize: 11 }}>· {toast.total - toast.count} {t.notifiedSomeFailed}</span>}
              </>
            )}
          </div>
        )}

        <div style={{
          position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
          width: '100%', maxWidth: 480, background: C.card,
          borderTop: `1px solid ${C.line}`, display: 'flex',
          padding: '8px 0 12px', zIndex: 50,
        }}>
          {tabs.map(tab_item => {
            const active = tab === tab_item.id;
            return (
              <button key={tab_item.id} onClick={() => { setTab(tab_item.id); setEditingJob(null); }} style={{
                flex: 1, background: 'none', border: 'none', cursor: 'pointer',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                color: active ? C.accent : C.muted, padding: '4px 0',
                fontFamily: F.body, fontSize: 10, fontWeight: 500, letterSpacing: '0.04em',
              }}>
                <tab_item.Icon size={20} strokeWidth={active ? 2 : 1.6} />
                <span style={{ textTransform: 'uppercase' }}>{tab_item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
