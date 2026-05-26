import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axiosInstance from '@/Helper/axiosInstance';
import { useSelector } from 'react-redux';

export const usePrivileges = () => {
    const { user } = useSelector((state) => state.auth);
    const [privilegeMap, setPrivilegeMap] = useState([]);
    const [loading, setLoading] = useState(true);

    // Fetch the ID -> Name mapping from DB
    useEffect(() => {
        const fetchPrivileges = async () => {
            try {
                // Check if already cached in session storage to avoid spamming API
                const cached = sessionStorage.getItem('privilegeMap');
                if (cached) {
                    setPrivilegeMap(JSON.parse(cached));
                    setLoading(false);
                    return;
                }

                const res = await axiosInstance.get('/api/privileges');
                if (res.data?.success) {
                    setPrivilegeMap(res.data.data);
                    sessionStorage.setItem('privilegeMap', JSON.stringify(res.data.data));
                }
            } catch (error) {
                console.error("Failed to fetch privileges", error);
            } finally {
                setLoading(false);
            }
        };

        fetchPrivileges();
    }, []);

    // Function to check if current user has a specific privilege
    // Can check by ID (int) or Name (string)
    const hasPrivilege = React.useCallback((requiredPrivilege) => {
        if (!user) return false;

        // Admin and Superadmin bypass
        if (user.isAdmin || user.role === 'SUPERADMIN' || user.role === 'ADMIN') return true;

        if (!user.privileges) return false;

        // Parse user's privileges string "1, 3, 5" -> [1, 3, 5]
        const userPrivs = typeof user.privileges === 'string'
            ? user.privileges.split(',').map(p => parseInt(p.trim()))
            : (Array.isArray(user.privileges) ? user.privileges : []);

        // If checking by ID
        if (typeof requiredPrivilege === 'number') {
            return userPrivs.includes(requiredPrivilege);
        }

        // If checking by Name, find the ID first
        if (typeof requiredPrivilege === 'string') {
            if (!Array.isArray(privilegeMap)) return false;
            const privObj = privilegeMap.find(p => p && p.name && p.name.toLowerCase() === requiredPrivilege.toLowerCase());
            if (!privObj) return false; // Privilege name not found in DB
            return userPrivs.includes(privObj.id);
        }

        return false;
    }, [user, privilegeMap]);

    // Helper to get all privileges (for mapping IDs to names in UI)
    const getAllPrivileges = React.useCallback(() => privilegeMap, [privilegeMap]);

    return React.useMemo(() => ({
        hasPrivilege,
        getAllPrivileges,
        loading,
        privilegeMap
    }), [hasPrivilege, getAllPrivileges, loading, privilegeMap]);
};

