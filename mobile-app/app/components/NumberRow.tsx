import React from 'react'
import { StyleProp, TextStyle, View, ViewProps } from 'react-native'
import NumberFormat from 'react-number-format'
import { tailwind } from '@tailwind'
import { ThemedText, ThemedView } from './themed'

type INumberRowProps = React.PropsWithChildren<ViewProps> & NumberRowProps
type SuffixType = 'text' | 'component'
interface NumberRowProps {
  lhs: string
  lhsIcon?: JSX.Element
  rhs: NumberRowRightElement
  textStyle?: StyleProp<TextStyle>
}
interface NumberRowRightElement {
  value: string | number
  suffix?: string
  testID: string
  suffixType?: SuffixType
}

export function NumberRow (props: INumberRowProps): JSX.Element {
  return (
    <ThemedView
      dark={tailwind('bg-gray-800 border-b border-gray-700')}
      light={tailwind('bg-white border-b border-gray-200')}
      style={tailwind('p-4 flex-row items-start w-full')}
    >
      <View style={tailwind('w-6/12 flex-row')}>
        <ThemedText style={[tailwind('text-sm'), props.textStyle]} testID={`${props.rhs.testID}_label`}>
          {props.lhs}
        </ThemedText>
        {props.lhsIcon}
      </View>

      <View
        style={tailwind('flex-1 flex-row justify-end flex-wrap items-center')}
      >
        <NumberFormat
          decimalScale={8}
          displayType='text'
          renderText={(val: string) => (
            <ThemedText
              dark={tailwind('text-gray-400')}
              light={tailwind('text-gray-500')}
              style={[tailwind('text-sm text-right'), props.textStyle]}
              testID={props.rhs.testID}
            >
              {val}
            </ThemedText>
          )}
          thousandSeparator
          value={props.rhs.value}
        />
        {
          props.rhs.suffixType === 'text' &&
            <ThemedText
              light={tailwind('text-gray-500')}
              dark={tailwind('text-gray-400')}
              style={tailwind('text-sm ml-1')}
              testID={`${props.rhs.testID}_suffix`}
            >
              {props.rhs.suffix}
            </ThemedText>
        }
        {
          props.rhs.suffixType === 'component' &&
          (props.children)
        }
      </View>
    </ThemedView>
  )
}
