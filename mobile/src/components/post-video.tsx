import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { VideoView, useVideoPlayer, type VideoPlayer } from 'expo-video';
import { colors } from './theme';

let activePlayer: VideoPlayer | null = null;

export function isVideoUrl(url: string) {
  return /\.(mp4|m4v|mov|webm|m3u8|mpd)(?:$|[?#])/i.test(url);
}

export function PostVideo({ uri }: { uri: string }) {
  const [error, setError] = useState(false);
  const player = useVideoPlayer(uri, (instance) => { instance.loop = false; });
  useEffect(() => {
    const subscription = player.addListener('statusChange', ({ status }) => setError(status === 'error'));
    const playback = player.addListener('playingChange', ({ isPlaying }) => {
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
    <Pressable accessibilityRole="button" accessibilityLabel={player.playing ? 'Videoni pauza qilish' : 'Videoni davom ettirish'} accessibilityHint="Video ustiga tegib pauza yoki davom ettiring" style={styles.tapArea} onPress={() => player.playing ? player.pause() : player.play()} />
  </View>;
}

const styles = StyleSheet.create({ frame: { ...StyleSheet.absoluteFill, backgroundColor: '#000' }, tapArea: { ...StyleSheet.absoluteFill }, error: { height: 250, alignItems: 'center', justifyContent: 'center', backgroundColor: '#070B12' }, errorText: { color: colors.muted, fontSize: 13 } });
