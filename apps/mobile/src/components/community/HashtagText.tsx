import { Pressable, StyleSheet, Text } from 'react-native';
import { colors } from '../../constants/colors';

type HashtagTextProps = {
  text: string;
  onTagPress?: (tag: string) => void;
};

export function HashtagText({ text, onTagPress }: HashtagTextProps) {
  const parts = text.split(/(#[a-zA-Z0-9_]{1,30})/g);

  return (
    <Text style={styles.body}>
      {parts.map((part, index) => {
        if (part.startsWith('#')) {
          const tag = part.slice(1).toLowerCase();
          return (
            <Text
              key={`${index}-${part}`}
              style={styles.tag}
              onPress={() => {
                if (onTagPress) {
                  onTagPress(tag);
                } else {
                  console.log('tag:', tag);
                }
              }}
            >
              {part}
            </Text>
          );
        }
        return <Text key={`${index}-${part}`}>{part}</Text>;
      })}
    </Text>
  );
}

const styles = StyleSheet.create({
  body: {
    color: colors.text.primary,
    fontSize: 15,
    fontFamily: 'Manrope-Regular',
    lineHeight: 22,
  },
  tag: {
    color: colors.accent.DEFAULT,
    fontFamily: 'Manrope-SemiBold',
  },
});
