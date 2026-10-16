export interface Item {
    id: string;
    name: string;
    price: number;
    createdAt: number;
    unlockAt: number;
    status: 'waiting' | 'bought' | 'saved';
    image?: string;
    resolvedAt?: number;
    category?: string;
    categoryIcon?: string;
    categoryColor?: string;
    notificationId?: string;
}

export interface Goal {
    id: string;
    name: string;
    targetAmount: number;
    currentAmount: number;
    icon: string;
    color: string;
    createdAt: number;
}

export interface Achievement {
    id: string;
    title: string;
    description: string;
    icon: string;
}

export const ACHIEVEMENTS: Achievement[] = [
    { id: 'first_save', title: 'Primer Ahorro', description: 'Has ahorrado tu primer deseo', icon: 'star' },
    { id: 'saver_10', title: 'Coleccionista', description: 'Has ahorrado 10 deseos', icon: 'library' },
    { id: 'saver_100', title: 'Ahorrador Novato', description: 'Has ahorrado más de $100', icon: 'wallet' },
    { id: 'saver_200', title: 'Buen Comienzo', description: 'Has ahorrado más de $200', icon: 'trending-up' },
    { id: 'saver_1000', title: 'Gran Ahorrador', description: 'Has ahorrado más de $1000', icon: 'trophy' },
    { id: 'saver_2000', title: 'Experto', description: 'Has ahorrado más de $2000', icon: 'ribbon' },
    { id: 'saver_5000', title: 'Magnate', description: 'Has ahorrado más de $5000', icon: 'diamond' },
    { id: 'saver_10000', title: 'Leyenda', description: 'Has ahorrado más de $10000', icon: 'ribbon' },
    { id: 'streak_3', title: 'Racha de Defensa', description: 'Resististe 3 compras impulsivas seguidas', icon: 'flame-outline' },
    { id: 'streak_5', title: 'Disciplina de Hierro', description: 'Resististe 5 compras impulsivas seguidas', icon: 'flame' },
    { id: 'streak_10', title: 'Inquebrantable', description: 'Resististe 10 compras impulsivas seguidas', icon: 'shield-checkmark' },
];

export type Theme = 'light' | 'dark';
