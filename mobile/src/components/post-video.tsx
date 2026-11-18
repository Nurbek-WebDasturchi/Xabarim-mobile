import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { VideoView, useVideoPlayer, type VideoPlayer } from 'expo-video';
import { colors } from './theme';

let activePlayer: VideoPlayer | null = null;

export function isVideoUrl(url: string) {
  return /\.(mp4|m4v|mov|webm|m3u8|mpd)(?:$|[?#])/i.test(url);
}

export function PostVideo({ uri }: { uri: string }) {
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [playing, setPlaying] = useState(false);
  const player = useVideoPlayer(uri, (instance) => { instance.loop = false; });
  useEffect(() => {
    const subscription = player.addListener('statusChange', ({ status }) => {
      setError(status === 'error');
      setLoading(status === 'loading');
    });
    const playback = player.addListener('playingChange', ({ isPlaying }) => {
      setPlaying(isPlaying);
      if (isPlaying) {
        if (activePlayer && activePlayer !== player) activePlayer.pause();
        activePlayer = player;
      } else if (activePlayer === player) activePlayer = null;
    });
    return () => {
      subscription.remove();
      playback.remove();
      if (activePlayer === player) activePlayer = null;
    };
  }, [player]);
  if (error) return <View style={styles.error}><Text style={styles.errorText}>Bu videoni ijro etib bo‘lmadi.</Text></View>;
  return <View style={styles.frame}>
    <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="contain" nativeControls={false} onFirstFrameRender={() => setError(false)} />
    <Pressable accessibilityRole="button" accessibilityLabel={playing ? 'Videoni pauza qilish' : 'Videoni davom ettirish'} accessibilityHint="Video ustiga tegib pauza yoki davom ettiring" style={styles.tapArea} onPress={() => playing ? player.pause() : player.play()}>
      {loading ? <View pointerEvents="none" style={styles.control}><ActivityIndicator size="large" color="white" /></View> : <View pointerEvents="none" style={[styles.control, playing && styles.controlPlaying]}><Ionicons name={playing ? 'pause' : 'play'} size={32} color="white" /></View>}
    </Pressable>
  </View>;
}

const styles = StyleSheet.create({ frame: { ...StyleSheet.absoluteFill, backgroundColor: '#000' }, tapArea: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' }, control: { width: 62, height: 62, borderRadius: 31, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' }, controlPlaying: { opacity: 0.85 }, error: { height: 250, alignItems: 'center', justifyContent: 'center', backgroundColor: '#070B12' }, errorText: { color: colors.muted, fontSize: 13 } });
