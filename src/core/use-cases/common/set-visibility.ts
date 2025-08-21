export interface HasSetVisibility {
  setVisibility(id: number, visible: boolean): Promise<void>;
}

export class SetVisibility {
  constructor(private repo: HasSetVisibility) {}
  execute(id: number, visible: boolean) {
    return this.repo.setVisibility(id, visible);
  }
}
