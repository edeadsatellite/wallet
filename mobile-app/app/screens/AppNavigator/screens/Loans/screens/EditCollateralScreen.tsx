import { SymbolIcon } from '@components/SymbolIcon'
import { ThemedIcon, ThemedScrollView, ThemedSectionTitle, ThemedText, ThemedView } from '@components/themed'
import { StackScreenProps } from '@react-navigation/stack'
import { tailwind } from '@tailwind'
import { translate } from '@translations'
import BigNumber from 'bignumber.js'
import { BottomSheetModal } from '@gorhom/bottom-sheet'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Platform, TouchableOpacity, View } from 'react-native'
import NumberFormat from 'react-number-format'
import { LoanParamList } from '../LoansNavigator'
import { BottomSheetNavScreen, BottomSheetWebWithNav, BottomSheetWithNav } from '@components/BottomSheetWithNav'
import { AddOrRemoveCollateralForm, AddOrRemoveCollateralResponse } from '../components/AddOrRemoveCollateralForm'
import { BottomSheetTokenList } from '@components/BottomSheetTokenList'
import { useThemeContext } from '@shared-contexts/ThemeProvider'
import { useWhaleApiClient } from '@shared-contexts/WhaleContext'
import { useLogger } from '@shared-contexts/NativeLoggingProvider'
import { useDispatch, useSelector } from 'react-redux'
import { RootState } from '@store'
import { fetchCollateralTokens } from '@store/loans'
import {
  CollateralToken,
  LoanVaultActive,
  LoanVaultTokenAmount
} from '@defichain/whale-api-client/dist/api/loan'
import { createSelector } from '@reduxjs/toolkit'
import { useTokensAPI } from '@hooks/wallet/TokensAPI'
import { IconButton } from '@components/IconButton'
import { VaultSectionTextRow } from '../components/VaultSectionTextRow'
import { DFITokenSelector, DFIUtxoSelector } from '@store/wallet'
import { useCollateralPrice } from '@screens/AppNavigator/screens/Loans/hooks/CollateralPrice'
import { useVaultStatus, VaultStatusTag } from '@screens/AppNavigator/screens/Loans/components/VaultStatusTag'
import { queueConvertTransaction } from '@hooks/wallet/Conversion'
import { useCollateralizationRatioColor } from '@screens/AppNavigator/screens/Loans/hooks/CollateralizationRatio'
import { useLoanOperations } from '@screens/AppNavigator/screens/Loans/hooks/LoanOperations'

type Props = StackScreenProps<LoanParamList, 'EditCollateralScreen'>

export interface Collateral {
  collateralId: string
  collateralFactor: BigNumber
  amount: BigNumber
  amountValue: BigNumber
  vaultProportion: BigNumber
  available: BigNumber
}

export interface CollateralItem extends CollateralToken {
  available: BigNumber
}

export function EditCollateralScreen ({
  navigation,
  route
}: Props): JSX.Element {
  const { vaultId } = route.params
  const client = useWhaleApiClient()
  const logger = useLogger()
  const { isLight } = useThemeContext()
  const [bottomSheetScreen, setBottomSheetScreen] = useState<BottomSheetNavScreen[]>([])
  const [activeVault, setActiveVault] = useState<LoanVaultActive>()
  const dispatch = useDispatch()
  const DFIUtxo = useSelector((state: RootState) => DFIUtxoSelector(state.wallet))
  const DFIToken = useSelector((state: RootState) => DFITokenSelector(state.wallet))
  const containerRef = useRef(null)
  const [isModalDisplayed, setIsModalDisplayed] = useState(false)
  const canUseOperations = useLoanOperations(activeVault?.state)

  const tokens = useTokensAPI()
  const getTokenAmount = (tokenId: string): BigNumber => {
    const id = tokenId === '0' ? '0_unified' : tokenId
    return new BigNumber(tokens.find((t) => t.id === id)?.amount ?? 0)
  }

  const {
    vaults
  } = useSelector((state: RootState) => state.loans)
  const collateralSelector = createSelector((state: RootState) => state.loans.collateralTokens, (collaterals) => collaterals.map((c) => {
    return {
      ...c,
      available: getTokenAmount(c.token.id)
    }
  }).sort((a, b) => b.available.minus(a.available).toNumber()))
  const collateralTokens: CollateralItem[] = useSelector((state: RootState) => collateralSelector(state))
  const [fee, setFee] = useState<BigNumber>(new BigNumber(0.0001))
  useEffect(() => {
    dispatch(fetchCollateralTokens({ client }))
  }, [])

  useEffect(() => {
    client.fee.estimate()
      .then((f) => setFee(new BigNumber(f)))
      .catch(logger.error)
  }, [])

  useEffect(() => {
    const v = vaults.find((v) => v.vaultId === vaultId) as LoanVaultActive
    if (v !== undefined) {
      setActiveVault({ ...v })
    }
  }, [vaults])

  const bottomSheetRef = useRef<BottomSheetModal>(null)
  const expandModal = useCallback(() => {
    if (Platform.OS === 'web') {
      setIsModalDisplayed(true)
    } else {
      bottomSheetRef.current?.present()
    }
  }, [])
  const dismissModal = useCallback(() => {
    if (Platform.OS === 'web') {
      setIsModalDisplayed(false)
    } else {
      bottomSheetRef.current?.close()
    }
  }, [])
  const onAddCollateral = async (item: AddOrRemoveCollateralResponse): Promise<void> => {
    dismissModal()
    const isConversionRequired = item.token.id === '0' ? new BigNumber(item.amount).gt(DFIToken.amount) : false
    const collateralItem = collateralTokens.find((col) => col.token.id === item.token.id)
    if (activeVault === undefined || collateralItem === undefined) {
      return
    }

    const initialParams = {
      name: 'ConfirmEditCollateralScreen',
      params: {
        vault: activeVault,
        amount: item.amount,
        token: item.token,
        fee,
        isAdd: true,
        collateralItem,
        conversion: undefined
      },
      merge: true
    }
    if (isConversionRequired) {
      const conversionAmount = new BigNumber(item.amount).minus(DFIToken.amount)
      initialParams.params.conversion = {
        DFIUtxo,
        DFIToken,
        isConversionRequired,
        conversionAmount: new BigNumber(item.amount).minus(DFIToken.amount)
      } as any
      queueConvertTransaction({
        mode: 'utxosToAccount',
        amount: conversionAmount
      }, dispatch, () => {
        navigation.navigate(initialParams)
      }, logger)
    } else {
      navigation.navigate(initialParams)
    }
  }

  const onRemoveCollateral = async (item: AddOrRemoveCollateralResponse): Promise<void> => {
    dismissModal()
    const collateralItem = collateralTokens.find((col) => col.token.id === item.token.id)
    if (activeVault !== undefined && collateralItem !== undefined) {
      navigation.navigate({
        name: 'ConfirmEditCollateralScreen',
        params: {
          vault: activeVault,
          amount: item.amount,
          token: item.token,
          fee,
          isAdd: false,
          collateralItem
        },
        merge: true
      })
    }
  }

  if (activeVault === undefined) {
    return <></>
  }

  return (
    <View style={tailwind('flex-1')} ref={containerRef}>
      <ThemedScrollView
        contentContainerStyle={tailwind('p-4 pt-0')}
      >
        <SectionTitle title='VAULT DETAILS' />
        <VaultIdSection vault={activeVault} />
        <AddCollateralButton
          disabled={!canUseOperations}
          onPress={() => {
            setBottomSheetScreen([
              {
                stackScreenName: 'TokenList',
                component: BottomSheetTokenList({
                  tokens: collateralTokens,
                  headerLabel: translate('screens/EditCollateralScreen', 'Select token to add'),
                  onCloseButtonPress: () => {
                    if (Platform.OS === 'web') {
                      setIsModalDisplayed(false)
                    } else {
                      bottomSheetRef.current?.close()
                    }
                  },
                  navigateToScreen: {
                    screenName: 'AddOrRemoveCollateralForm',
                    onButtonPress: onAddCollateral
                  }
                }),
                option: {
                  header: () => null,
                  headerBackTitleVisible: false
                }
              },
              {
                stackScreenName: 'AddOrRemoveCollateralForm',
                component: AddOrRemoveCollateralForm,
                option: {
                  headerStatusBarHeight: 1,
                  headerBackgroundContainerStyle: tailwind('-top-5 border-b', {
                    'border-gray-200': isLight,
                    'border-gray-700': !isLight
                  }),
                  headerTitle: '',
                  headerBackTitleVisible: false
                }
              }
            ])
            expandModal()
          }}
        />
        {
          activeVault.collateralAmounts?.length > 0 && (
            <SectionTitle title='COLLATERALS' />
          )
        }
        {activeVault.collateralAmounts.map((collateral, index) => {
          const collateralItem = collateralTokens.find((col) => col.token.id === collateral.id)
          if (collateralItem !== undefined) {
            const params = {
              stackScreenName: 'AddOrRemoveCollateralForm',
              component: AddOrRemoveCollateralForm,
              initialParam: {
                token: collateralItem.token,
                available: '',
                onButtonPress: undefined,
                onCloseButtonPress: () => bottomSheetRef.current?.close(),
                collateralFactor: new BigNumber(collateralItem.factor ?? 0).times(100),
                isAdd: true,
                current: new BigNumber(collateral.amount)
              },
              option: {
                header: () => null
              }
            }
            return (
              <CollateralCard
                vault={activeVault}
                key={collateral.displaySymbol}
                collateralItem={collateralItem}
                totalCollateralValue={new BigNumber(activeVault.collateralValue)}
                collateral={collateral}
                onAddPress={() => {
                  params.initialParam.available = collateralItem.available.toFixed(8)
                  params.initialParam.onButtonPress = onAddCollateral as any
                  setBottomSheetScreen([
                    params
                  ])
                  expandModal()
                }}
                onRemovePress={() => {
                  params.initialParam.available = new BigNumber(collateral.amount).toFixed(8)
                  params.initialParam.onButtonPress = onRemoveCollateral as any
                  params.initialParam.isAdd = false
                  setBottomSheetScreen([
                    params
                  ])
                  expandModal()
                }}
              />
            )
          } else {
            // TODO Add Skeleton Loader
            return <View key={index} />
          }
        })}
      </ThemedScrollView>
      <BottomSheetWithNav
        modalRef={bottomSheetRef}
        screenList={bottomSheetScreen}
      />

      {Platform.OS === 'web' && (
        <BottomSheetWebWithNav
          modalRef={containerRef}
          screenList={bottomSheetScreen}
          isModalDisplayed={isModalDisplayed}
        />
      )}
      {Platform.OS !== 'web' && (
        <BottomSheetWithNav
          modalRef={bottomSheetRef}
          screenList={bottomSheetScreen}
        />
      )}
    </View>
  )
}

function SectionTitle (props: { title: string }): JSX.Element {
  return (
    <ThemedSectionTitle
      style={tailwind('text-xs pb-2 pt-4 font-medium')}
      text={translate('screens/EditCollateralScreen', props.title)}
    />
  )
}

function VaultIdSection (props: { vault: LoanVaultActive }): JSX.Element {
  const { vault } = props
  const colRatio = new BigNumber(vault.collateralRatio)
  const minColRatio = new BigNumber(vault.loanScheme.minColRatio)
  const totalLoanAmount = new BigNumber(vault.loanValue)
  const vaultState = useVaultStatus(vault.state, colRatio, minColRatio, totalLoanAmount)
  const colors = useCollateralizationRatioColor({
    colRatio,
    minColRatio,
    totalLoanAmount
  })
  return (
    <ThemedView
      light={tailwind('bg-white border-gray-200')}
      dark={tailwind('bg-gray-800 border-gray-700')}
      style={tailwind('border rounded px-4 py-3')}
    >
      <View style={tailwind('flex flex-row items-center mb-2')}>
        <View
          style={tailwind('flex flex-1 mr-5')}
        >
          <ThemedText
            style={tailwind('font-medium')}
            numberOfLines={1}
            ellipsizeMode='middle'
          >
            {vault.vaultId}
          </ThemedText>
        </View>
        <VaultStatusTag status={vaultState.status} vaultStats={vaultState.vaultStats} />
      </View>
      <VaultSectionTextRow
        testID='text_total_collateral_value'
        value={new BigNumber(vault.collateralValue ?? 0).toFixed(2)} prefix='$'
        lhs={translate('screens/EditCollateralScreen', 'Total collateral (USD)')}
      />
      <VaultSectionTextRow
        testID='text_total_collateral_value' value={new BigNumber(vault.loanValue ?? 0).toFixed(2)}
        prefix='$'
        lhs={translate('screens/EditCollateralScreen', 'Total loans (USD)')}
      />
      <VaultSectionTextRow
        testID='text_total_collateral_value'
        value={BigNumber.maximum(new BigNumber(vault.collateralRatio ?? 0), 0).toFixed(2)}
        suffix='%'
        suffixType='text'
        lhs={translate('screens/EditCollateralScreen', 'Collateralization ratio')}
        rhsThemedProps={colors}
        info={{
          title: 'Collateralization ratio',
          message: 'The collateralization ratio represents the amount of collaterals deposited in a vault in relation to the loan amount, expressed in percentage.'
        }}
      />
      <VaultSectionTextRow
        testID='text_total_collateral_value'
        value={new BigNumber(vault.loanScheme.minColRatio ?? 0).toFixed(2)} suffix='%'
        suffixType='text'
        lhs={translate('screens/EditCollateralScreen', 'Min. collateralization ratio')}
        info={{
          title: 'Min. collateralization ratio',
          message: 'Minimum required collateralization ratio based on loan scheme selected. A vault will go into liquidation when the collateralization ratio goes below the minimum requirement.'
        }}
      />
      <VaultSectionTextRow
        testID='text_vault_interest_value'
        value={new BigNumber(vault.loanScheme.interestRate ?? 0).toFixed(2)} suffix='%'
        suffixType='text'
        lhs={translate('screens/EditCollateralScreen', 'Vault interest')}
        info={{
          title: 'Annual vault interest',
          message: 'Annual vault interest rate based on the loan scheme selected.'
        }}
      />
    </ThemedView>
  )
}

interface CollateralCardProps {
  collateral: LoanVaultTokenAmount
  onAddPress: () => void
  onRemovePress: () => void
  collateralItem: CollateralItem
  totalCollateralValue: BigNumber
  vault: LoanVaultActive
}

function CollateralCard (props: CollateralCardProps): JSX.Element {
  const {
    collateral,
    collateralItem,
    totalCollateralValue,
    vault
  } = props
  const canUseOperations = useLoanOperations(vault.state)
  const prices = useCollateralPrice(new BigNumber(collateral.amount), collateralItem, totalCollateralValue)
  return (
    <ThemedView
      light={tailwind('bg-white border-gray-200')}
      dark={tailwind('bg-gray-800 border-gray-700')}
      style={tailwind('border rounded p-4 mb-2')}
    >
      <ThemedView
        light={tailwind('bg-white border-gray-200')}
        dark={tailwind('bg-gray-800 border-gray-700')}
        style={tailwind('flex flex-row items-center justify-between border-b pb-4 mb-2')}
      >
        <View style={tailwind('flex flex-row items-center')}>
          <SymbolIcon
            symbol={collateral.displaySymbol} styleProps={{
            width: 24,
            height: 24
          }}
          />
          <ThemedText
            style={tailwind('font-medium ml-1 mr-2')}
          >
            {collateral.displaySymbol}
          </ThemedText>
        </View>
        <View style={tailwind('flex flex-row')}>
          <IconButton
            iconType='MaterialIcons'
            iconName='add'
            iconSize={20}
            disabled={!canUseOperations}
            onPress={() => props.onAddPress()}
          />
          <IconButton
            iconType='MaterialIcons'
            iconName='remove'
            iconSize={20}
            style={tailwind('ml-2')}
            disabled={!canUseOperations}
            onPress={() => props.onRemovePress()}
          />
        </View>
      </ThemedView>
      <View style={tailwind('flex flex-row justify-between')}>
        <View style={tailwind('w-8/12')}>
          <CardLabel text='Collateral amount (USD)' />
          <View style={tailwind('mt-0.5')}>
            <NumberFormat
              value={collateral.amount}
              thousandSeparator
              decimalScale={8}
              displayType='text'
              suffix={` ${collateral.displaySymbol}`}
              renderText={(val: string) => (
                <ThemedText
                  dark={tailwind('text-gray-50')}
                  light={tailwind('text-gray-900')}
                  style={tailwind('text-sm font-medium')}
                >
                  {val}
                  {
                    !new BigNumber(prices.activePrice).isZero() &&
                      <NumberFormat
                        value={prices.collateralPrice.toFixed(2)}
                        thousandSeparator
                        decimalScale={2}
                        displayType='text'
                        prefix='$'
                        renderText={(val: string) => (
                          <ThemedText
                            dark={tailwind('text-gray-400')}
                            light={tailwind('text-gray-500')}
                            style={tailwind('text-xs')}
                          >
                            {` /${val}`}
                          </ThemedText>
                      )}
                      />
                  }
                </ThemedText>
              )}
            />

          </View>
        </View>
        <View style={tailwind('w-4/12 flex items-end')}>
          <CardLabel text='Vault %' />
          <NumberFormat
            value={prices.vaultShare.toFixed(2)}
            thousandSeparator
            decimalScale={2}
            displayType='text'
            suffix='%'
            renderText={(val: string) => (
              <ThemedView
                light={tailwind('bg-gray-100')}
                dark={tailwind('bg-gray-900')}
                style={tailwind('px-2 py-0.5 rounded')}
              >
                <ThemedText
                  light={tailwind('text-gray-900')}
                  dark={tailwind('text-gray-50')}
                  style={tailwind('text-sm font-medium')}
                >
                  {val}
                </ThemedText>
              </ThemedView>
            )}
          />
        </View>
      </View>
    </ThemedView>
  )
}

function CardLabel (props: { text: string }): JSX.Element {
  return (
    <ThemedText
      light={tailwind('text-gray-500')}
      dark={tailwind('text-gray-400')}
      style={tailwind('text-xs mb-1')}
    >
      {translate('screens/EditCollateralScreen', props.text)}
    </ThemedText>
  )
}

function AddCollateralButton (props: { disabled: boolean, onPress: () => void }): JSX.Element {
  return (
    <TouchableOpacity
      disabled={props.disabled}
      style={tailwind('mt-6 mb-3 flex flex-row justify-center')}
      onPress={props.onPress}
    >
      <ThemedIcon
        iconType='MaterialIcons'
        name='add'
        size={14}
        light={tailwind({
          'text-primary-500': !props.disabled,
          'text-gray-300': props.disabled
        })}
        dark={tailwind({
          'text-darkprimary-500': !props.disabled,
          'text-gray-600': props.disabled
        })}
      />
      <ThemedText
        light={tailwind({
          'text-primary-500': !props.disabled,
          'text-gray-300': props.disabled
        })}
        dark={tailwind({
          'text-darkprimary-500': !props.disabled,
          'text-gray-600': props.disabled
        })}
        style={tailwind('pl-2.5 text-sm font-medium leading-4 mb-2')}
      >
        {translate('screens/EditCollateralScreen', 'ADD TOKEN AS COLLATERAL')}
      </ThemedText>
    </TouchableOpacity>
  )
}
