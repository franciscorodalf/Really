import React, { useState } from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import { BarChart, PieChart } from 'react-native-gifted-charts';
import { useStore } from '../context/StoreContext';
import { Colors } from '../constants/Colors';
import { ThemedText } from './themed-text';
import { formatWorkHours } from '../utils/workHours';
import {
    getCategoryTotals,
    getMonthlyTotals,
    getWeekdayTotals,
    sumTotals,
    type PeriodTotal,
    type TrendItem,
    type TrendType,
} from '../utils/trendStats';

interface TrendChartsProps {
    items: TrendItem[];
    type: TrendType;
    accentColor: string;
    /** Solo para tests: referencia temporal fija. Por defecto se fija una vez al montar. */
    now?: number;
}

// Paleta fija para categorías sin color propio.
const FALLBACK_PALETTE = ['#6C5CE7', '#00B894', '#FDCB6E', '#FF7675', '#0984E3', '#E17055', '#A29BFE', '#55EFC4'];

// 20 + 20 de padding de pantalla y 16 + 16 de padding de la tarjeta.
const HORIZONTAL_CHROME = 72;
const CHART_EDGE_SPACING = 8;
const CHART_HEIGHT = 140;
// Margen sobre la barra más alta para que su etiqueta superior no se recorte.
const BAR_HEADROOM = 1.15;

function formatAmount(value: number): string {
    return `$${Math.round(value)}`;
}

function formatCompact(value: number): string {
    if (value >= 1000) {
        const thousands = value / 1000;
        return `${thousands >= 10 ? Math.round(thousands) : thousands.toFixed(1).replace(/\.0$/, '')}k`;
    }
    return String(Math.round(value));
}

export function TrendCharts({ items, type, accentColor, now }: TrendChartsProps) {
    const { theme, hourlyWage } = useStore();
    const AppTheme = Colors[theme];
    const { width: windowWidth } = useWindowDimensions();
    const [reference] = useState(() => now ?? Date.now());

    const chartWidth = Math.max(windowWidth - HORIZONTAL_CHROME, 120);
    const hasItems = items.some((item) => item.status === type);

    if (!hasItems) {
        const subject = type === 'saved' ? 'ahorro' : 'gasto';
        return (
            <View style={[styles.card, { backgroundColor: AppTheme.surface }]}>
                <ThemedText style={{ fontSize: 14, lineHeight: 20, color: AppTheme.subtext, textAlign: 'center' }}>
                    {`Todavía no hay datos de ${subject} para mostrar tendencias.`}
                </ThemedText>
            </View>
        );
    }

    const monthly = getMonthlyTotals(items, type, reference);
    const weekday = getWeekdayTotals(items, type);
    const categories = getCategoryTotals(items, type);

    const monthlyTotal = sumTotals(monthly);
    const categoryTotal = sumTotals(categories);
    const workHoursLabel = formatWorkHours(monthlyTotal, hourlyWage);

    const renderBars = (data: PeriodTotal[]) => {
        const count = data.length;
        const slot = (chartWidth - CHART_EDGE_SPACING * 2) / count;
        const barWidth = Math.min(Math.max(Math.floor(slot * 0.6), 4), 36);
        const spacing = Math.max(Math.floor(slot - barWidth), 0);
        const maxValue = Math.max(...data.map((entry) => entry.total), 1) * BAR_HEADROOM;

        return (
            <BarChart
                data={data.map((entry) => ({
                    value: entry.total,
                    label: entry.label,
                    frontColor: accentColor,
                    topLabelComponent:
                        entry.total > 0
                            ? () => (
                                  <ThemedText
                                      numberOfLines={1}
                                      style={{ fontSize: 10, lineHeight: 14, color: AppTheme.subtext, width: slot, textAlign: 'center' }}
                                  >
                                      {formatCompact(entry.total)}
                                  </ThemedText>
                              )
                            : undefined,
                }))}
                width={chartWidth}
                height={CHART_HEIGHT}
                barWidth={barWidth}
                spacing={spacing}
                initialSpacing={CHART_EDGE_SPACING}
                endSpacing={CHART_EDGE_SPACING}
                maxValue={maxValue}
                noOfSections={3}
                barBorderRadius={4}
                frontColor={accentColor}
                hideYAxisText
                yAxisThickness={0}
                yAxisLabelWidth={0}
                xAxisThickness={1}
                xAxisColor={AppTheme.border}
                hideRules
                disableScroll
                isAnimated
                xAxisLabelTextStyle={{ fontSize: 10, lineHeight: 14, color: AppTheme.subtext }}
            />
        );
    };

    return (
        <View style={styles.container}>
            <View style={[styles.card, { backgroundColor: AppTheme.surface }]}>
                <ThemedText type="defaultSemiBold">Evolución mensual</ThemedText>
                {monthly.some((month) => month.count > 0) ? (
                    <>
                        <View style={styles.chartBox}>{renderBars(monthly)}</View>
                        <ThemedText style={{ fontSize: 13, lineHeight: 18, color: AppTheme.subtext }}>
                            {`Total 6 meses: ${formatAmount(monthlyTotal)}`}
                        </ThemedText>
                        {workHoursLabel && (
                            <ThemedText style={{ fontSize: 12, lineHeight: 16, color: AppTheme.subtext }}>
                                {workHoursLabel}
                            </ThemedText>
                        )}
                    </>
                ) : (
                    <ThemedText style={{ fontSize: 14, lineHeight: 20, color: AppTheme.subtext }}>
                        Sin actividad en los últimos 6 meses.
                    </ThemedText>
                )}
            </View>

            <View style={[styles.card, { backgroundColor: AppTheme.surface }]}>
                <ThemedText type="defaultSemiBold">Por día de la semana</ThemedText>
                <View style={styles.chartBox}>{renderBars(weekday)}</View>
            </View>

            <View style={[styles.card, { backgroundColor: AppTheme.surface }]}>
                <ThemedText type="defaultSemiBold">Por categoría</ThemedText>
                {categoryTotal > 0 && (
                    <View style={styles.pieBox}>
                        <PieChart
                            data={categories.map((category, index) => ({
                                value: category.total,
                                color: category.color ?? FALLBACK_PALETTE[index % FALLBACK_PALETTE.length],
                            }))}
                            donut
                            radius={80}
                            innerRadius={50}
                            innerCircleColor={AppTheme.surface}
                        />
                    </View>
                )}
                <View style={styles.legend}>
                    {categories.map((category, index) => {
                        const percent = categoryTotal > 0 ? Math.round((category.total / categoryTotal) * 100) : 0;
                        return (
                            <View key={category.name} style={styles.legendRow}>
                                <View
                                    style={[
                                        styles.legendDot,
                                        { backgroundColor: category.color ?? FALLBACK_PALETTE[index % FALLBACK_PALETTE.length] },
                                    ]}
                                />
                                <ThemedText numberOfLines={1} style={{ flex: 1, fontSize: 14, lineHeight: 20 }}>
                                    {category.name}
                                </ThemedText>
                                <ThemedText style={{ fontSize: 13, lineHeight: 18, color: AppTheme.subtext }}>
                                    {`${formatAmount(category.total)} · ${percent}%`}
                                </ThemedText>
                            </View>
                        );
                    })}
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        gap: 16,
        marginBottom: 14,
    },
    card: {
        borderRadius: 20,
        padding: 16,
        gap: 12,
    },
    chartBox: {
        alignItems: 'center',
        overflow: 'hidden',
    },
    pieBox: {
        alignItems: 'center',
    },
    legend: {
        gap: 8,
    },
    legendRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    legendDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
    },
});
