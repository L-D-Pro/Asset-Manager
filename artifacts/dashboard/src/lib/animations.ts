// Centralized animation configuration for the entire dashboard.
// All motion components source timing from here to ensure consistency.

export const easing = {
 /** Smooth, refined deceleration — for entrances and layout shifts */
 smooth: [0.22, 1, 0.36, 1] as const,
 /** Snappy, responsive — for micro-interactions (hover, tap) */
 snappy: [0.16, 1, 0.3, 1] as const,
 /** Standard ease-out for simple transitions */
 out: [0, 0, 0.2, 1] as const,
};

export const duration = {
 fast: 0.15,
 normal: 0.25,
 slow: 0.4,
 slower: 0.6,
};

/** Shared motion variants used across the app */
export const variants = {
 fadeIn: {
 hidden: { opacity: 0 },
 visible: { opacity: 1, transition: { duration: duration.normal, ease: easing.smooth } },
 },
 fadeInUp: {
 hidden: { opacity: 0, y: 12 },
 visible: {
 opacity: 1,
 y: 0,
 transition: { duration: duration.slow, ease: easing.smooth },
 },
 },
 fadeInDown: {
 hidden: { opacity: 0, y: -12 },
 visible: {
 opacity: 1,
 y: 0,
 transition: { duration: duration.slow, ease: easing.smooth },
 },
 },
 scaleIn: {
 hidden: { opacity: 0, scale: 0.96 },
 visible: {
 opacity: 1,
 scale: 1,
 transition: { duration: duration.normal, ease: easing.snappy },
 },
 },
 slideInRight: {
 hidden: { opacity: 0, x: 20 },
 visible: {
 opacity: 1,
 x: 0,
 transition: { duration: duration.slow, ease: easing.smooth },
 },
 },
 slideInLeft: {
 hidden: { opacity: 0, x: -20 },
 visible: {
 opacity: 1,
 x: 0,
 transition: { duration: duration.slow, ease: easing.smooth },
 },
 },
 staggerContainer: {
 hidden: {},
 visible: {
 transition: {
 staggerChildren: 0.05,
 delayChildren: 0.05,
 },
 },
 },
 staggerItem: {
 hidden: { opacity: 0, y: 10 },
 visible: {
 opacity: 1,
 y: 0,
 transition: { duration: duration.normal, ease: easing.smooth },
 },
 },
 pageTransition: {
 initial: { opacity: 0, y: 8 },
 animate: { opacity: 1, y: 0, transition: { duration: duration.slow, ease: easing.smooth } },
 exit: { opacity: 0, y: -4, transition: { duration: duration.fast, ease: easing.out } },
 },
};
