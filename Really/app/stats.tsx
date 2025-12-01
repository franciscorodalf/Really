import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView, Platform, Dimensions } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useStore, Item } from '../context/StoreContext';
import { Ionicons } from '@expo/vector-icons';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import { StatusBar } from 'expo-status-bar';

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
    const { items, theme, moneySaved, moneySpent } = useStore();
    const [selectedDate, setSelectedDate] = useState('');
    const [showAnalysis, setShowAnalysis] = useState(false);

    const isSaved = currentType === 'saved';
    const isDark = theme === 'dark';
    const bg = isDark ? '#000' : '#f8f9fa';
    const text = isDark ? '#fff' : '#000';
    const cardBg = isDark ? '#1a1a1a' : '#fff';
    const accentColor = isSaved ? '#4CAF50' : '#F44336'; // Green for saved, Red for spent
    const subText = isDark ? '#999' : '#666';

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
        const categoryStats: Record<string, { saved: number, spent: number }> = {};

        items.forEach(item => {
            if (item.status !== 'saved' && item.status !== 'bought') return;

            const cat = item.category || 'Otros';
            if (!categoryStats[cat]) {
                categoryStats[cat] = { saved: 0, spent: 0 };
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
        <View style={[styles.container, { backgroundColor: bg }]}>
            <StatusBar style={isDark ? 'light' : 'dark'} />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: text }]}>
                    {isSaved ? 'Ahorrado' : 'Gastado'}
                </Text>
                <View style={{ width: 24 }} />
            </View>

            {/* Tabs */}
            <View style={styles.tabsContainer}>
                <TouchableOpacity
                    style={[styles.tab, isSaved && styles.activeTab]}
                    onPress={() => setCurrentType('saved')}
                >
                    <Text style={[styles.tabText, isSaved ? { color: '#4CAF50' } : { color: subText }]}>Ahorrado</Text>
                    {isSaved && <View style={[styles.activeIndicator, { backgroundColor: '#4CAF50' }]} />}
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tab, !isSaved && styles.activeTab]}
                    onPress={() => setCurrentType('spent')}
                >
                    <Text style={[styles.tabText, !isSaved ? { color: '#F44336' } : { color: subText }]}>Gastado</Text>
                    {!isSaved && <View style={[styles.activeIndicator, { backgroundColor: '#F44336' }]} />}
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                {/* Total Card */}
                <View style={[styles.totalCard, { backgroundColor: accentColor }]}>
                    <Text style={styles.totalLabel}>Total {isSaved ? 'Ahorrado' : 'Gastado'}</Text>
                    <Text style={styles.totalAmount}>
                        ${(isSaved ? moneySaved : moneySpent).toFixed(0)}
                    </Text>
                </View>

                {/* Calendar */}
                <View style={[styles.calendarContainer, { backgroundColor: cardBg }]}>
                    <Calendar
                        theme={{
                            backgroundColor: cardBg,
                            calendarBackground: cardBg,
                            textSectionTitleColor: isDark ? '#b6c1cd' : '#b6c1cd',
                            selectedDayBackgroundColor: accentColor,
                            selectedDayTextColor: '#ffffff',
                            todayTextColor: accentColor,
                            dayTextColor: text,
                            textDisabledColor: '#d9e1e8',
                            dotColor: accentColor,
                            selectedDotColor: '#ffffff',
                            arrowColor: accentColor,
                            disabledArrowColor: '#d9e1e8',
                            monthTextColor: text,
                            indicatorColor: accentColor,
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
                        <Text style={[styles.sectionTitle, { color: text }]}>
                            {new Date(selectedDate).toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                        </Text>
                        {selectedDateItems.length > 0 ? (
                            selectedDateItems.map(item => (
                                <View key={item.id} style={[styles.itemCard, { backgroundColor: cardBg }]}>
                                    <View>
                                        <Text style={[styles.itemName, { color: text }]}>{item.name}</Text>
                                        <Text style={[styles.itemCategory, { color: subText }]}>{item.category || 'Sin categoría'}</Text>
                                    </View>
                                    <Text style={[styles.itemPrice, { color: accentColor }]}>${item.price}</Text>
                                </View>
                            ))
                        ) : (
                            <Text style={[styles.emptyText, { color: subText }]}>
                                No hay actividad este día.
                            </Text>
                        )}
                    </View>
                ) : (
                    <Text style={[styles.hintText, { color: subText }]}>
                        Selecciona un día en el calendario para ver detalles.
                    </Text>
                )}

                {/* Contrast Button */}
                <TouchableOpacity
                    style={[styles.contrastButton, { borderColor: accentColor }]}
                    onPress={() => setShowAnalysis(true)}
                >
                    <Ionicons name="analytics-outline" size={20} color={accentColor} />
                    <Text style={[styles.contrastButtonText, { color: accentColor }]}>Contrastar datos</Text>
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
                    <View style={[styles.modalContent, { backgroundColor: isDark ? '#1a1a1a' : '#fff' }]}>
                        <View style={styles.modalHeader}>
                            <Text style={[styles.modalTitle, { color: text }]}>Tu Balance</Text>
                            <TouchableOpacity onPress={() => setShowAnalysis(false)} style={styles.closeModalButton}>
                                <Ionicons name="close" size={24} color={text} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={{ maxHeight: '90%' }} contentContainerStyle={{ paddingBottom: 40 }}>

                            {/* Global Chart */}
                            <View style={[styles.card, { backgroundColor: isDark ? '#2a2a2a' : '#f8f9fa' }]}>
                                <Text style={[styles.cardTitle, { color: subText }]}>Resumen Global</Text>
                                <View style={styles.chartContainer}>
                                    <View style={styles.barContainer}>
                                        <View style={[styles.barSegment, { flex: advancedStats.savingsRate || 1, backgroundColor: '#4CAF50', borderTopLeftRadius: 12, borderBottomLeftRadius: 12 }]} />
                                        <View style={[styles.barSegment, { flex: advancedStats.spendingRate || 1, backgroundColor: '#F44336', borderTopRightRadius: 12, borderBottomRightRadius: 12 }]} />
                                    </View>
                                    <View style={styles.legendContainer}>
                                        <View style={styles.legendItem}>
                                            <Text style={[styles.legendValue, { color: '#4CAF50' }]}>{advancedStats.savingsRate.toFixed(1)}%</Text>
                                            <Text style={[styles.legendLabel, { color: subText }]}>Ahorrado (${advancedStats.totalSaved.toFixed(0)})</Text>
                                        </View>
                                        <View style={[styles.legendItem, { alignItems: 'flex-end' }]}>
                                            <Text style={[styles.legendValue, { color: '#F44336' }]}>{advancedStats.spendingRate.toFixed(1)}%</Text>
                                            <Text style={[styles.legendLabel, { color: subText }]}>Gastado (${advancedStats.totalSpent.toFixed(0)})</Text>
                                        </View>
                                    </View>
                                </View>
                            </View>

                            {/* Records Grid */}
                            <Text style={[styles.sectionHeader, { color: text }]}>Récords</Text>
                            <View style={styles.grid}>
                                <View style={[styles.gridCard, { backgroundColor: isDark ? '#2a2a2a' : '#f8f9fa' }]}>
                                    <Ionicons name="trophy-outline" size={24} color="#FFD700" style={{ marginBottom: 8 }} />
                                    <Text style={[styles.gridLabel, { color: subText }]}>Mayor Ahorro</Text>
                                    <Text style={[styles.gridValue, { color: text }]}>${advancedStats.maxSavedItem?.price || 0}</Text>
                                    <Text style={[styles.gridSub, { color: subText }]} numberOfLines={1}>{advancedStats.maxSavedItem?.name || '-'}</Text>
                                </View>
                                <View style={[styles.gridCard, { backgroundColor: isDark ? '#2a2a2a' : '#f8f9fa' }]}>
                                    <Ionicons name="flame-outline" size={24} color="#F44336" style={{ marginBottom: 8 }} />
                                    <Text style={[styles.gridLabel, { color: subText }]}>Mayor Gasto</Text>
                                    <Text style={[styles.gridValue, { color: text }]}>${advancedStats.maxSpentItem?.price || 0}</Text>
                                    <Text style={[styles.gridSub, { color: subText }]} numberOfLines={1}>{advancedStats.maxSpentItem?.name || '-'}</Text>
                                </View>
                            </View>

                            {/* Averages Grid */}
                            <View style={styles.grid}>
                                <View style={[styles.gridCard, { backgroundColor: isDark ? '#2a2a2a' : '#f8f9fa' }]}>
                                    <Text style={[styles.gridLabel, { color: subText }]}>Promedio Ahorro</Text>
                                    <Text style={[styles.gridValue, { color: '#4CAF50' }]}>${advancedStats.avgSaved.toFixed(0)}</Text>
                                </View>
                                <View style={[styles.gridCard, { backgroundColor: isDark ? '#2a2a2a' : '#f8f9fa' }]}>
                                    <Text style={[styles.gridLabel, { color: subText }]}>Promedio Gasto</Text>
                                    <Text style={[styles.gridValue, { color: '#F44336' }]}>${advancedStats.avgSpent.toFixed(0)}</Text>
                                </View>
                            </View>

                            {/* Categories */}
                            <Text style={[styles.sectionHeader, { color: text, marginTop: 24 }]}>Por Categorías</Text>
                            <View style={[styles.card, { backgroundColor: isDark ? '#2a2a2a' : '#f8f9fa', padding: 0 }]}>
                                {advancedStats.categories.map((cat, index) => (
                                    <View key={cat.name} style={[
                                        styles.categoryRow,
                                        { borderBottomColor: isDark ? '#333' : '#eee', borderBottomWidth: index === advancedStats.categories.length - 1 ? 0 : 1 }
                                    ]}>
                                        <View style={styles.categoryHeader}>
                                            <Text style={[styles.categoryName, { color: text }]}>{cat.name}</Text>
                                            <Text style={[styles.categoryTotal, { color: text }]}>${cat.total}</Text>
                                        </View>
                                        <View style={styles.miniBarContainer}>
                                            {cat.saved > 0 && (
                                                <View style={[styles.miniBar, { width: `${(cat.saved / cat.total) * 100}%`, backgroundColor: '#4CAF50' }]} />
                                            )}
                                            {cat.spent > 0 && (
                                                <View style={[styles.miniBar, { width: `${(cat.spent / cat.total) * 100}%`, backgroundColor: '#F44336' }]} />
                                            )}
                                        </View>
                                        <View style={styles.categoryDetails}>
                                            <Text style={styles.detailText}>
                                                <Text style={{ color: '#4CAF50' }}>+${cat.saved}</Text> • <Text style={{ color: '#F44336' }}>-${cat.spent}</Text>
                                            </Text>
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
        paddingBottom: 10,
    },
    tabsContainer: {
        flexDirection: 'row',
        paddingHorizontal: 20,
        marginBottom: 10,
    },
    tab: {
        marginRight: 24,
        paddingBottom: 8,
        position: 'relative',
    },
    activeTab: {
        // styles for active tab container if needed
    },
    tabText: {
        fontSize: 16,
        fontWeight: '600',
    },
    activeIndicator: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 3,
        borderRadius: 1.5,
    },
    backButton: {
        padding: 4,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '700',
    },
    content: {
        padding: 20,
        paddingBottom: 40,
    },
    totalCard: {
        padding: 24,
        borderRadius: 24,
        marginBottom: 24,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
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
        fontWeight: '800',
    },
    calendarContainer: {
        borderRadius: 24,
        overflow: 'hidden',
        marginBottom: 24,
        padding: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    itemsSection: {
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 12,
        textTransform: 'capitalize',
    },
    itemCard: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderRadius: 16,
        marginBottom: 8,
    },
    itemName: {
        fontSize: 16,
        fontWeight: '500',
    },
    itemCategory: {
        fontSize: 12,
        marginTop: 2,
    },
    itemPrice: {
        fontSize: 16,
        fontWeight: '700',
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
    contrastButtonText: {
        fontSize: 16,
        fontWeight: '700',
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
        height: '85%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 32,
    },
    modalTitle: {
        fontSize: 24,
        fontWeight: '800',
        letterSpacing: -0.5,
    },
    closeModalButton: {
        padding: 4,
        backgroundColor: 'rgba(128,128,128,0.1)',
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
    sectionHeader: {
        fontSize: 18,
        fontWeight: '700',
        marginBottom: 16,
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
    gridValue: {
        fontSize: 20,
        fontWeight: '700',
        marginBottom: 2,
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
    categoryName: {
        fontSize: 16,
        fontWeight: '600',
    },
    categoryTotal: {
        fontSize: 16,
        fontWeight: '700',
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
    detailText: {
        fontSize: 12,
        fontWeight: '600',
    },
});
