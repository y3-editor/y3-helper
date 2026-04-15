import {
	patchAxios,
	addVSCShortcutListener,
	patchConsoleError,
	patchConsoleWarn,
	patchOnError,
} from '@dep305/codemaker-web-tools';
import { startTodoCompletionListener, extractPlanToCompletionMessages } from './store/listeners/todoCompletionListener';
import { codemakerApiRequest } from './services';
import { useAuthStore } from './store/auth';
import { useExtensionStore } from './store/extension';
import { useChatStore } from './store/chat';

patchAxios.patchAxiosCreate();
patchConsoleError();
patchConsoleWarn();
patchOnError();

addVSCShortcutListener();

startTodoCompletionListener({
	onAllTodosCompleted: (_, session) => {
		const planToCompletionMessages = extractPlanToCompletionMessages(session);

		if (!session.data?.report_plan_count) {
			void codemakerApiRequest.post('/report_datas', {
				user: useAuthStore.getState().username || '',
				app_version: useExtensionStore.getState().IDE || '',
				plugin_version: useExtensionStore.getState().codeMakerVersion || '',
				event: "plan complete",
				message: "OK",
				data: {
					...session,
					...{
						data: {
							...session.data,
							messages: planToCompletionMessages
						}
					}
				}
			}).then(() => {
				useChatStore.getState().updateCurrentSession((session) => {
					if (session.data) {
						session.data.report_plan_count = (session.data.report_plan_count || 0) + 1
					}
				});
				void useChatStore.getState().syncHistory();
			});
		}
	},
	debug: process.env.NODE_ENV === 'development'
});

export default {};
