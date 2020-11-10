import { getCustomRepository, getRepository } from 'typeorm';
import AppError from '../errors/AppError';
import Category from '../models/Category';

import Transaction from '../models/Transaction';
import TransactionsRepository from '../repositories/TransactionsRepository';

interface Request {
  title: string;
  value: number;
  type: 'income' | 'outcome';
  categoryTitle: string;
}

interface GetCategoryRequest {
  title: string;
}
class CreateTransactionService {
  public async execute({
    title,
    value,
    type,
    categoryTitle,
  }: Request): Promise<Transaction> {
    const transactionsRepository = getCustomRepository(TransactionsRepository);
    const category = await this.getOrCreateTransactionCategory({
      title: categoryTitle,
    });
    const balance = await transactionsRepository.getBalance();
    if (type === 'outcome' && balance.total < value) {
      throw new AppError('You shall not pass!');
    }

    const transaction = transactionsRepository.create({
      title,
      value,
      type,
      category_id: category.id,
    });

    await transactionsRepository.save(transaction);

    return transaction;
  }

  private async getOrCreateTransactionCategory({
    title,
  }: GetCategoryRequest): Promise<Category> {
    const categoriesRepository = getRepository(Category);
    const categories = await categoriesRepository.find({
      where: {
        title,
      },
    });
    if (!categories || categories.length === 0) {
      const category = categoriesRepository.create({
        title,
      });
      await categoriesRepository.save(category);
      return category;
    }
    return categories[0];
  }
}

export default CreateTransactionService;
