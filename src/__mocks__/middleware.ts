export const mockAuth = { userId: "user-1" };

export const checkJwt = (req: any, _res: any, next: any) => {
  req.auth = { payload: { sub: mockAuth.userId } };
  next();
};
