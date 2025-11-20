import axios from 'axios';

export interface ProjectItem {
    guid: string;
    name: string;
    previewImage: string;
    appId: string;
    // Add other fields if needed
}

export interface ProjectListResponse {
    code: number;
    data: {
        list: ProjectItem[];
        total: number;
        [key: string]: any;
    };
}

export interface TokenResponse {
    code: number;
    data: string; // The token string
    msg?: string;
}

/**
 * Fetch the access token.
 * POST /bimv3d/uc/auth/token
 */
export async function fetchToken(serverUrl: string, appId: string, secret: string): Promise<string> {
    // Ensure serverUrl doesn't end with slash
    const baseUrl = serverUrl.replace(/\/+$/, '');
    const url = `${baseUrl}/bimv3d/uc/auth/token`;

    const response = await axios.post<TokenResponse>(url, {
        appId,
        appSecret: secret
    });

    if (response.data.code === 200 && response.data.data) {
        return response.data.data;
    }

    throw new Error(response.data.msg || 'Failed to fetch token');
}

/**
 * Fetch the project list.
 * Model: POST /bimv3d/data/project/latest/page/model
 * Scene: POST /bimv3d/data/proj/page/common
 */
export async function fetchProjects(
    serverUrl: string,
    token: string,
    appId: string,
    pageNo: number = 1,
    pageSize: number = 15,
    name: string = '',
    type: 'model' | 'scene' = 'model'
): Promise<ProjectItem[]> {
    const baseUrl = serverUrl.replace(/\/+$/, '');

    let url = '';
    if (type === 'model') {
        url = `${baseUrl}/bimv3d/data/project/latest/page/model`;
    } else {
        url = `${baseUrl}/bimv3d/data/proj/page/common`;
    }

    const response = await axios.post<ProjectListResponse>(
        url,
        {
            appId,
            name
        },
        {
            params: {
                appId,
                pageNo,
                pageSize
            },
            headers: {
                'access-token': token
            }
        }
    );

    if (response.data.code === 200 && response.data.data && Array.isArray(response.data.data.list)) {
        return response.data.data.list;
    }

    throw new Error('Failed to fetch project list');
}

/**
 * Get the full preview image URL.
 * Prefix: /bimv3d/rf/resource/read
 */
export function getPreviewImageUrl(serverUrl: string, imagePath: string): string {
    if (!imagePath) return '';
    if (imagePath.startsWith('http')) return imagePath;

    const baseUrl = serverUrl.replace(/\/+$/, '');
    // imagePath usually starts with /, but let's be safe
    const cleanPath = imagePath.startsWith('/') ? imagePath : `/${imagePath}`;

    // The user mentioned: https://szsp.suitbim.com.cn:7201/bimv3d/rf/resource/read
    // And the previewImage in JSON is like: /proj/ec0244585ac24936b1e0e15d7b6ee67d/bd316b0190496f92692d1aa8204a2f7e.png
    // So we need to append the path to the read endpoint?
    // Wait, the user said: "previewImage 是缩略图 需要加上前缀 https://szsp.suitbim.com.cn:7201/bimv3d/rf/resource/read 就可以正常访问"
    // This likely means the full URL is `BASE_URL + /bimv3d/rf/resource/read + imagePath`?
    // Or is it `BASE_URL + /bimv3d/rf/resource/read?path=imagePath`?
    // Or simply that the `read` endpoint acts as a base?
    // Let's assume standard file serving: `BASE_URL/bimv3d/rf/resource/read/proj/...`
    // Or maybe it's a query param?
    // Let's look at the example again.
    // User: "previewImage 是缩略图 需要加上前缀 ... 就可以正常访问"
    // Usually this means concatenation.
    // Let's try concatenation first: `BASE_URL/bimv3d/rf/resource/read${imagePath}`

    return `${baseUrl}/bimv3d/rf/resource/read${cleanPath}`;
}
