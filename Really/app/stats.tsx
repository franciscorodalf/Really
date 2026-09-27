import React, { useState, useMemo } from 'react';
import { View, StyleSheet, TouchableOpacity, Modal, ScrollView, Platform, Dimensions } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useStore, Item } from '../context/StoreContext';
import { Ionicons } from '@expo/vector-icons';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import { StatusBar } from 'expo-status-bar';
import { Colors } from '../constants/Colors';
import { ThemedText } from '../components/themed-text';
import { LinearGradient } from 'expo-linear-gradient';

// Configuración de idioma español para el calendario
LocaleConfig.locales['es'] = {
    monthNames: [
        'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ],
    monthNamesShort: ['Ene.', 'Feb.', 'Mar.', 'Abr.', 'May.', 'Jun.', 'Jul.', 'Ago.', 'Sep.', 'Oct.', 'Nov.', 'Dic.'],
    dayNames: ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'],
    dayNamesShort: ['Dom.', 'Lun.', 'Mar.', 'Mié.', 'Jue.', 'Vie.', 'Sáb.'],
    today: "Hoy"
};
LocaleConfig.defaultLocale = 'es';

const { width } = Dimensions.get('window');

export default function StatsScreen() {
    const router = useRouter();
    const { type } = useLocalSearchParams<{ type: 'saved' | 'spent' }>();
    const [currentType, setCurrentType] = useState<'saved' | 'spent'>(type || 'saved');
    const { items, moneySaved, moneySpent, theme: colorScheme } = useStore();
    const [selectedDate, setSelectedDate] = useState('');
    const [showAnalysis, setShowAnalysis] = useState(false);

    const AppTheme = Colors[colorScheme];

    const isSaved = currentType === 'saved';

    // Theme adaptations
    const accentColor = isSaved ? AppTheme.secondary : AppTheme.danger; // Mint for saved, Red for spent

    // Filtrar items según el tipo (para el calendario)
    const filteredItems = useMemo(() => {
        return items.filter(item => {
            if (isSaved) return item.status === 'saved';
            return item.status === 'bought';
        });
    }, [items, isSaved]);

    // Generar marcas para el calendario
    const markedDates = useMemo(() => {
        const marks: any = {};
        filteredItems.forEach(item => {
            const dateToUse = item.resolvedAt || item.createdAt;
            const dateStr = new Date(dateToUse).toISOString().split('T')[0];

            if (!marks[dateStr]) {
                marks[dateStr] = { marked: true, dotColor: accentColor };
            }
        });

        if (selectedDate) {
            marks[selectedDate] = {
                ...marks[selectedDate],
                selected: true,
                selectedColor: accentColor,
                disableTouchEvent: true
            };
        }

        return marks;
    }, [filteredItems, selectedDate, accentColor]);

    // Items de la fecha seleccionada
    const selectedDateItems = useMemo(() => {
        if (!selectedDate) return [];
        return filteredItems.filter(item => {
            const dateToUse = item.resolvedAt || item.createdAt;
            const dateStr = new Date(dateToUse).toISOString().split('T')[0];
            return dateStr === selectedDate;
        });
    }, [filteredItems, selectedDate]);

    // ANÁLISIS AVANZADO
    const advancedStats = useMemo(() => {
        const allSavedItems = items.filter(i => i.status === 'saved');
        const allSpentItems = items.filter(i => i.status === 'bought');

        const totalSaved = allSavedItems.reduce((sum, i) => sum + i.price, 0);
        const totalSpent = allSpentItems.reduce((sum, i) => sum + i.price, 0);
        const totalMoney = totalSaved + totalSpent;

        const savingsRate = totalMoney > 0 ? (totalSaved / totalMoney) * 100 : 0;
        const spendingRate = totalMoney > 0 ? (totalSpent / totalMoney) * 100 : 0;

        // Récords
        const maxSavedItem = allSavedItems.length > 0 ? allSavedItems.reduce((prev, current) => (prev.price > current.price) ? prev : current) : null;
        const maxSpentItem = allSpentItems.length > 0 ? allSpentItems.reduce((prev, current) => (prev.price > current.price) ? prev : current) : null;

        // Promedios
        const avgSaved = allSavedItems.length > 0 ? totalSaved / allSavedItems.length : 0;
        const avgSpent = allSpentItems.length > 0 ? totalSpent / allSpentItems.length : 0;

        // Desglose por categorías
        const categoryStats: Record<string, { saved: number, spent: number, color?: string, icon?: string }> = {};

        items.forEach(item => {
            if (item.status !== 'saved' && item.status !== 'bought') return;

            const cat = item.category || 'Otros';
            if (!categoryStats[cat]) {
                categoryStats[cat] = {
                    saved: 0,
                    spent: 0,
                    color: item.categoryColor,
                    icon: item.categoryIcon
                };
            }

            if (item.status === 'saved') {
                categoryStats[cat].saved += item.price;
            } else {
                categoryStats[cat].spent += item.price;
            }
        });

        // Ordenar categorías por gasto total descendente
        const sortedCategories = Object.entries(categoryStats)
            .map(([name, stats]) => ({ name, ...stats, total: stats.saved + stats.spent }))
            .sort((a, b) => b.total - a.total);

        return {
            totalSaved,
            totalSpent,
            savingsRate,
            spendingRate,
            categories: sortedCategories,
            totalItems: allSavedItems.length + allSpentItems.length,
            maxSavedItem,
            maxSpentItem,
            avgSaved,
            avgSpent
        };
    }, [items]);

    return (
        <View style={[styles.container, { backgroundColor: AppTheme.background }]}>
            <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={AppTheme.text} />
                </TouchableOpacity>
                <ThemedText type="subtitle" style={{ color: AppTheme.text }}>
                    {isSaved ? 'Ahorrado' : 'Gastado'}
                </ThemedText>
                <View style={{ width: 24 }} />
            </View>

            {/* Tabs */}
            <View style={styles.tabsContainer}>
                <TouchableOpacity
                    style={[
                        styles.tab,
                        { backgroundColor: isSaved ? AppTheme.secondary : AppTheme.surface },
                    ]}
                    onPress={() => setCurrentType('saved')}
                >
                    <ThemedText style={[styles.tabText, { color: isSaved ? '#fff' : AppTheme.subtext }]}>Ahorrado</ThemedText>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[
                        styles.tab,
                        { backgroundColor: !isSaved ? AppTheme.danger : AppTheme.surface },
                    ]}
                    onPress={() => setCurrentType('spent')}
                >
                    <ThemedText style={[styles.tabText, { color: !isSaved ? '#fff' : AppTheme.subtext }]}>Gastado</ThemedText>
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                {/* Total Card */}
                <View style={[styles.totalCard]}>
                    <LinearGradient
                        colors={isSaved ? [AppTheme.secondary, '#00b894'] : [AppTheme.danger, '#d63031']}
                        style={{ padding: 24, borderRadius: 24, width: '100%', alignItems: 'center' }}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                    >
                        <ThemedText style={styles.totalLabel}>Total {isSaved ? 'Ahorrado' : 'Gastado'}</ThemedText>
                        <ThemedText style={styles.totalAmount}>
                            ${(isSaved ? moneySaved : moneySpent).toFixed(0)}
                        </ThemedText>
                    </LinearGradient>
                </View>

                {/* Calendar */}
                <View style={[styles.calendarContainer, { backgroundColor: AppTheme.surface }]}>
                    <Calendar
                        theme={{
                            backgroundColor: AppTheme.surface,
                            calendarBackground: AppTheme.surface,
                            textSectionTitleColor: AppTheme.subtext,
                            selectedDayBackgroundColor: accentColor,
                            selectedDayTextColor: '#ffffff',
                            todayTextColor: accentColor,
                            dayTextColor: AppTheme.text,
                            textDisabledColor: AppTheme.border,
                            dotColor: accentColor,
                            selectedDotColor: '#ffffff',
                            arrowColor: accentColor,
                            disabledArrowColor: '#d9e1e8',
                            monthTextColor: AppTheme.text,
                            indicatorColor: accentColor,
                            textDayFontFamily: 'Poppins_400Regular',
                            textMonthFontFamily: 'Poppins_600SemiBold',
                            textDayHeaderFontFamily: 'Poppins_500Medium',
                        }}
                        markedDates={markedDates}
                        onDayPress={(day: { dateString: React.SetStateAction<string>; }) => {
                            setSelectedDate(day.dateString);
                        }}
                    />
                </View>

                {/* Selected Date Items */}
                {selectedDate ? (
                    <View style={styles.itemsSection}>
                        <ThemedText type="defaultSemiBold" style={{ marginBottom: 16 }}>
                            {new Date(selectedDate).toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                        </ThemedText>
                        {selectedDateItems.length > 0 ? (
                            selectedDateItems.map(item => (
                                <View key={item.id} style={[styles.itemCard, { backgroundColor: AppTheme.surface }]}>
                                    <View>
                                        <ThemedText type="defaultSemiBold">{item.name}</ThemedText>
                                        <ThemedText style={{ fontSize: 12, color: AppTheme.subtext, marginTop: 2 }}>{item.category || 'Sin categoría'}</ThemedText>
                                    </View>
                                    <ThemedText type="defaultSemiBold" style={{ color: accentColor }}>${item.price}</ThemedText>
                                </View>
                            ))
                        ) : (
                            <ThemedText style={[styles.emptyText, { color: AppTheme.subtext }]}>
                                No hay actividad este día.
                            </ThemedText>
                        )}
                    </View>
                ) : (
                    <ThemedText style={[styles.hintText, { color: AppTheme.subtext }]}>
                        Selecciona un día en el calendario para ver detalles.
                    </ThemedText>
                )}

                {/* Contrast Button */}
                <TouchableOpacity
                    style={[styles.contrastButton, { borderColor: accentColor }]}
                    onPress={() => setShowAnalysis(true)}
                >
                    <Ionicons name="analytics-outline" size={20} color={accentColor} />
                    <ThemedText style={{ color: accentColor, fontWeight: '600' }}>Contrastar datos</ThemedText>
                </TouchableOpacity>

            </ScrollView>

            {/* Analysis Modal */}
            <Modal
                visible={showAnalysis}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setShowAnalysis(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: AppTheme.background }]}>
                        <View style={styles.modalHeader}>
                            <ThemedText type="title">Tu Balance</ThemedText>
                            <TouchableOpacity onPress={() => setShowAnalysis(false)} style={styles.closeModalButton}>
                                <Ionicons name="close" size={24} color={AppTheme.text} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={{ maxHeight: '90%' }} contentContainerStyle={{ paddingBottom: 40 }}>

                            {/* Global Chart */}
                            <View style={[styles.card, { backgroundColor: AppTheme.surface }]}>
                                <ThemedText style={[styles.cardTitle, { color: AppTheme.subtext }]}>Resumen Global</ThemedText>
                                <View style={styles.chartContainer}>
                                    <View style={styles.barContainer}>
                                        <View style={[styles.barSegment, { flex: advancedStats.savingsRate || 1, backgroundColor: AppTheme.secondary, borderTopLeftRadius: 12, borderBottomLeftRadius: 12 }]} />
                                        <View style={[styles.barSegment, { flex: advancedStats.spendingRate || 1, backgroundColor: AppTheme.danger, borderTopRightRadius: 12, borderBottomRightRadius: 12 }]} />
                                    </View>
                                    <View style={styles.legendContainer}>
                                        <View style={styles.legendItem}>
                                            <ThemedText style={[styles.legendValue, { color: AppTheme.secondary }]}>{advancedStats.savingsRate.toFixed(1)}%</ThemedText>
                                            <ThemedText style={[styles.legendLabel, { color: AppTheme.subtext }]}>Ahorrado (${advancedStats.totalSaved.toFixed(0)})</ThemedText>
                                        </View>
                                        <View style={[styles.legendItem, { alignItems: 'flex-end' }]}>
                                            <ThemedText style={[styles.legendValue, { color: AppTheme.danger }]}>{advancedStats.spendingRate.toFixed(1)}%</ThemedText>
                                            <ThemedText style={[styles.legendLabel, { color: AppTheme.subtext }]}>Gastado (${advancedStats.totalSpent.toFixed(0)})</ThemedText>
                                        </View>
                                    </View>
                                </View>
                            </View>

                            {/* Records Grid */}
                            <ThemedText type="subtitle" style={{ marginBottom: 16 }}>Récords</ThemedText>
                            <View style={styles.grid}>
                                <View style={[styles.gridCard, { backgroundColor: AppTheme.surface }]}>
                                    <Ionicons name="trophy-outline" size={24} color="#FFD700" style={{ marginBottom: 8 }} />
                                    <ThemedText style={[styles.gridLabel, { color: AppTheme.subtext }]}>Mayor Ahorro</ThemedText>
                                    <ThemedText type="defaultSemiBold" style={{ fontSize: 20 }}>${advancedStats.maxSavedItem?.price || 0}</ThemedText>
                                    <ThemedText style={[styles.gridSub, { color: AppTheme.subtext }]} numberOfLines={1}>{advancedStats.maxSavedItem?.name || '-'}</ThemedText>
                                </View>
                                <View style={[styles.gridCard, { backgroundColor: AppTheme.surface }]}>
                                    <Ionicons name="flame-outline" size={24} color={AppTheme.danger} style={{ marginBottom: 8 }} />
                                    <ThemedText style={[styles.gridLabel, { color: AppTheme.subtext }]}>Mayor Gasto</ThemedText>
                                    <ThemedText type="defaultSemiBold" style={{ fontSize: 20 }}>${advancedStats.maxSpentItem?.price || 0}</ThemedText>
                                    <ThemedText style={[styles.gridSub, { color: AppTheme.subtext }]} numberOfLines={1}>{advancedStats.maxSpentItem?.name || '-'}</ThemedText>
                                </View>
                            </View>

                            {/* Averages Grid */}
                            <View style={styles.grid}>
                                <View style={[styles.gridCard, { backgroundColor: AppTheme.surface }]}>
                                    <ThemedText style={[styles.gridLabel, { color: AppTheme.subtext }]}>Promedio Ahorro</ThemedText>
                                    <ThemedText type="defaultSemiBold" style={{ color: AppTheme.secondary, fontSize: 18 }}>${advancedStats.avgSaved.toFixed(0)}</ThemedText>
                                </View>
                                <View style={[styles.gridCard, { backgroundColor: AppTheme.surface }]}>
                                    <ThemedText style={[styles.gridLabel, { color: AppTheme.subtext }]}>Promedio Gasto</ThemedText>
                                    <ThemedText type="defaultSemiBold" style={{ color: AppTheme.danger, fontSize: 18 }}>${advancedStats.avgSpent.toFixed(0)}</ThemedText>
                                </View>
                            </View>

                            {/* Categories */}
                            <ThemedText type="subtitle" style={{ marginTop: 24, marginBottom: 16 }}>Por Categorías</ThemedText>
                            <View style={[styles.card, { backgroundColor: AppTheme.surface, padding: 0 }]}>
                                {advancedStats.categories.map((cat, index) => (
                                    <View key={cat.name} style={[
                                        styles.categoryRow,
                                        { borderBottomColor: AppTheme.border, borderBottomWidth: index === advancedStats.categories.length - 1 ? 0 : 1 }
                                    ]}>
                                        <View style={styles.categoryHeader}>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                                <View style={{
                                                    width: 32, height: 32, borderRadius: 16,
                                                    backgroundColor: (cat.color || '#999') + '20',
                                                    alignItems: 'center', justifyContent: 'center'
                                                }}>
                                                    <Ionicons name={cat.icon as any || 'pricetag'} size={16} color={cat.color || AppTheme.text} />
                                                </View>
                                                <ThemedText type="defaultSemiBold">{cat.name}</ThemedText>
                                            </View>
                                            <ThemedText type="defaultSemiBold">${cat.total}</ThemedText>
                                        </View>
                                        <View style={styles.miniBarContainer}>
                                            {cat.saved > 0 && (
                                                <View style={[styles.miniBar, { width: `${(cat.saved / cat.total) * 100}%`, backgroundColor: AppTheme.secondary }]} />
                                            )}
                                            {cat.spent > 0 && (
                                                <View style={[styles.miniBar, { width: `${(cat.spent / cat.total) * 100}%`, backgroundColor: AppTheme.danger }]} />
                                            )}
                                        </View>
                                        <View style={styles.categoryDetails}>
                                            <ThemedText style={{ fontSize: 12, fontWeight: '600' }}>
                                                <ThemedText style={{ color: AppTheme.secondary, fontSize: 12 }}>+${cat.saved}</ThemedText> • <ThemedText style={{ color: AppTheme.danger, fontSize: 12 }}>-${cat.spent}</ThemedText>
                                            </ThemedText>
                                        </View>
                                    </View>
                                ))}
                            </View>

                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 60,
        paddingBottom: 20,
    },
    tabsContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 12,
        paddingHorizontal: 20,
        marginBottom: 10,
    },
    tab: {
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 20,
    },
    tabText: {
        fontSize: 16,
        fontWeight: '600',
    },
    backButton: {
        padding: 4,
    },
    content: {
        padding: 20,
        paddingBottom: 40,
    },
    totalCard: {
        marginBottom: 24,
        borderRadius: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
    },
    totalLabel: {
        color: 'rgba(255,255,255,0.8)',
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 8,
        textTransform: 'uppercase',
    },
    totalAmount: {
        color: '#fff',
        fontSize: 36,
        fontWeight: 'bold',
        fontFamily: 'Poppins_700Bold',
        lineHeight: 44,
    },
    calendarContainer: {
        borderRadius: 24,
        overflow: 'hidden',
        marginBottom: 24,
        padding: 10,
    },
    itemsSection: {
        marginBottom: 24,
    },
    itemCard: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderRadius: 16,
        marginBottom: 8,
    },
    emptyText: {
        textAlign: 'center',
        fontStyle: 'italic',
        marginTop: 10,
    },
    hintText: {
        textAlign: 'center',
        marginBottom: 24,
    },
    contrastButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        borderRadius: 16,
        borderWidth: 2,
        gap: 8,
        marginTop: 10,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        padding: 24,
        paddingTop: 32,
        height: '90%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 32,
    },
    closeModalButton: {
        padding: 4,
        borderRadius: 20,
    },
    card: {
        borderRadius: 20,
        padding: 20,
        marginBottom: 24,
    },
    cardTitle: {
        fontSize: 12,
        fontWeight: '600',
        textTransform: 'uppercase',
        marginBottom: 16,
        letterSpacing: 0.5,
    },
    chartContainer: {
        gap: 12,
    },
    barContainer: {
        flexDirection: 'row',
        height: 32,
        marginBottom: 8,
    },
    barSegment: {
        height: '100%',
    },
    legendContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    legendItem: {
        gap: 2,
    },
    legendValue: {
        fontSize: 18,
        fontWeight: '700',
    },
    legendLabel: {
        fontSize: 12,
        fontWeight: '500',
    },
    grid: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 12,
    },
    gridCard: {
        flex: 1,
        padding: 16,
        borderRadius: 20,
        alignItems: 'flex-start',
    },
    gridLabel: {
        fontSize: 12,
        fontWeight: '600',
        marginBottom: 4,
    },
    gridSub: {
        fontSize: 12,
        opacity: 0.8,
    },
    categoryRow: {
        padding: 16,
    },
    categoryHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 10,
    },
    miniBarContainer: {
        flexDirection: 'row',
        height: 6,
        borderRadius: 3,
        overflow: 'hidden',
        backgroundColor: 'rgba(128,128,128,0.1)',
        marginBottom: 8,
    },
    miniBar: {
        height: '100%',
    },
    categoryDetails: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
    },
});
