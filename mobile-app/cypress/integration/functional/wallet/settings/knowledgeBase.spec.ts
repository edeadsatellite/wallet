import { EnvironmentNetwork } from '../../../../../../shared/environment'

context('Wallet - Settings', () => {
  before(function () {
    cy.intercept('**/settings/flags', {
      body: [
        {
          id: 'loan',
          name: 'Loan',
          stage: 'public',
          version: '>=0.0.0',
          description: 'Loan',
          networks: [EnvironmentNetwork.RemotePlayground, EnvironmentNetwork.LocalPlayground],
          platforms: ['ios', 'android', 'web']
        }
      ]
    })
    cy.createEmptyWallet(true)
    cy.getByTestID('header_settings').click()
    cy.getByTestID('setting_navigate_About').click()
    cy.getByTestID('knowledge_base_link').should('exist').click()
  })

  it('should navigate to knowledge base page', function () {
    cy.url().should('include', 'app/Settings/KnowledgeBaseScreen')
    cy.getByTestID('knowledge_base_screen').should('exist')
  })

  it('should navigate to recovery words faq from knowledge base page', function () {
    cy.getByTestID('recovery_words_faq').should('exist').click()
    cy.url().should('include', 'app/Settings/RecoveryWordsFaq')
    cy.go('back')
    cy.url().should('include', 'app/Settings/KnowledgeBaseScreen')
  })

  it('should navigate to passcode faq from knowledge base page', function () {
    cy.getByTestID('passcode_faq').should('exist').click()
    cy.url().should('include', 'app/Settings/PasscodeFaq')
    cy.go('back')
    cy.url().should('include', 'app/Settings/KnowledgeBaseScreen')
  })

  it('should navigate to UTXO vs Token faq from knowledge base page', function () {
    cy.getByTestID('utxo_and_token_faq').should('exist').click()
    cy.url().should('include', 'app/Settings/TokensVsUtxo')
    cy.go('back')
    cy.url().should('include', 'app/Settings/KnowledgeBaseScreen')
  })

  it('should navigate to Loans faq from knowledge base page', function () {
    cy.getByTestID('loans_faq').should('exist').click()
    cy.url().should('include', 'app/Settings/LoansFaq')
    cy.go('back')
    cy.url().should('include', 'app/Settings/KnowledgeBaseScreen')
  })
})
