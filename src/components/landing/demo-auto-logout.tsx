'use client';

import { useEffect } from 'react';
import { logout } from '@/actions/logout';

export function DemoAutoLogout({ email }: { email?: string | null }) {
    useEffect(() => {
        if (email === 'test@gmail.com') {
            logout();
        }
    }, [email]);

    return null;
}
