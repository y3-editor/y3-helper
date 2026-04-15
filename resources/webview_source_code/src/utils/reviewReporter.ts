import * as React from 'react';
import { $post } from '../request/index';

interface ReportConfig {
    ide: string;
    event: string;
    user: string;
    extends?: any;
}

const useReport = () => {
    const reporter = React.useMemo(() => {
        return {
            uploadReport: (config: ReportConfig) => {
                const { ide, event, user } = config;
                $post(
                    `/proxy/y3maker/reports`,
                    {
                        ide,
                        event,
                        user,
                        extends: config?.extends || {},
                    },
                    {
                        headers: {
                            IDE: ide,
                        },
                    },
                );
            },
        };
    }, []);

    return reporter;
};

export default useReport;
