/** Dados do cliente que o checkout leva para a revisão do pedido (`location.state.formData`). */
export interface ReviewFormData {
  name: string;
  email: string;
  phone: string;
  cpf: string;
  postalCode: string;
  prefecture: string;
  city: string;
  address: string;
  building: string;
  country: string;
}

/** Frete escolhido no checkout (`location.state.shipping`); só o que a revisão mostra. */
export interface ReviewShipping {
  carrier: string;
  estimatedDays: string;
}
